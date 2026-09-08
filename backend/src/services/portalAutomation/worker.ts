// ---------------------------------------------------------------------------
// Worker — coordinates the full browser automation lifecycle
//
// Manages Playwright browser instances (capped concurrency), loads recipes,
// restores sessions, drives the recipe engine, and records the final result
// to the AutomationRun record.
// ---------------------------------------------------------------------------

import { EventEmitter } from 'node:events';
import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { Types } from 'mongoose';

import { logger } from '../../config/logger.js';
import { AutomationRun } from '../../models/automationRun.model.js';
import { HandoffBroker } from './handoffBroker.js';
import { ScreenCaster } from './screenCaster.js';
import { executeRecipe } from './recipeEngine.js';
import { restoreSessionState, saveSessionState } from './sessionVault.js';
import type { RecipeEngineContext } from './recipeEngine.js';
import type { RunRequest } from './types.js';

const MAX_CONCURRENT_BROWSERS = 2;
const MAX_RUN_TIME_MS = 30 * 60 * 1000; // 30 mins hard limit

export interface AutomationWorkerOptions {
  headless?: boolean;
}

export class AutomationWorker extends EventEmitter {
  private activeRuns = new Map<
    string,
    {
      broker: HandoffBroker;
      caster: ScreenCaster;
      context: BrowserContext;
      page: Page;
    }
  >();

  private browserPromise: Promise<Browser> | null = null;
  private readonly headless: boolean;
  private shuttingDown = false;

  constructor(options: AutomationWorkerOptions = {}) {
    super();
    this.headless = options.headless ?? true;
  }

  private async getBrowser(): Promise<Browser> {
    if (this.shuttingDown) throw new Error('Worker is shutting down');

    if (!this.browserPromise) {
      this.browserPromise = chromium
        .launch({
          headless: this.headless,
          args: [
            '--disable-dev-shm-usage', // Critical for Docker/Render
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
          ],
        })
        .catch((err) => {
          this.browserPromise = null;
          throw err;
        });
    }
    return this.browserPromise;
  }

  /**
   * Start an automation run. Throws if concurrency limit reached.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async startRun(request: RunRequest): Promise<void> {
    if (this.shuttingDown) throw new Error('Worker is shutting down');
    if (this.activeRuns.size >= MAX_CONCURRENT_BROWSERS) {
      throw new Error(`Worker at capacity (max ${MAX_CONCURRENT_BROWSERS} browsers)`);
    }

    // Fire-and-forget the actual run to avoid blocking the caller
    void this.executeRun(request).catch((err) => {
      logger.error(
        { event: 'worker.run_crashed', runId: request.runId, err },
        'automation run crashed out of band',
      );
    });
  }

  private async executeRun(request: RunRequest): Promise<void> {
    const { runId, clientId, recipe, portalPayload, computed } = request;
    const runStart = Date.now();
    let browser: Browser;
    let context: BrowserContext;
    let page: Page;

    try {
      browser = await this.getBrowser();
    } catch (err) {
      await this.markRunFailed(
        runId,
        `Failed to launch browser: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    try {
      // 1. Restore session state if available
      const storedStateStr = await restoreSessionState(clientId as unknown as Types.ObjectId, recipe.portal);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const storageState = storedStateStr ? JSON.parse(storedStateStr) : undefined;

      context = await browser.newContext({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        storageState,
        viewport: { width: 1280, height: 800 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      page = await context.newPage();
    } catch (err) {
      await this.markRunFailed(
        runId,
        `Failed to create browser context: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    const broker = new HandoffBroker();
    const caster = new ScreenCaster();

    this.activeRuns.set(runId, { broker, caster, context, page });
    caster.start(page);

    // Forward SSE events to router
    caster.on('frame', (frameData: string) => {
      this.emit('event', { kind: 'frame', runId, timestamp: Date.now(), frameData });
    });

    broker.on('requested', () => {
      // emitted via engine's handoff_required event
    });

    try {
      // Mark run as running
      await AutomationRun.findByIdAndUpdate(runId, { status: 'running' }).exec();

      const engineCtx: RecipeEngineContext = {
        page,
        broker,
        caster,
        portalPayload,
        computed,
        runId,
        onEvent: (evt) => this.emit('event', evt),
      };

      // 2. Execute recipe
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Hard timeout reached (30m)')), MAX_RUN_TIME_MS);
      });

      const result = await Promise.race([executeRecipe(recipe, engineCtx), timeoutPromise]);

      // 3. Save new session state (capture cookies after login)
      const newState = await context.storageState();
      await saveSessionState(clientId as unknown as Types.ObjectId, recipe.portal, JSON.stringify(newState));

      // 4. Update run record
      if (result.success) {
        const resultData = {
          arn: result.extractedValues['result.arn'] ?? null,
          acknowledgementRef: result.extractedValues['result.acknowledgementRef'] ?? null,
          portalRef: result.extractedValues['result.portalRef'] ?? null,
        };

        await AutomationRun.findByIdAndUpdate(runId, {
          status: 'succeeded',
          finishedAt: new Date(),
          result: resultData,
        }).exec();

        this.emit('event', {
          kind: 'run_done',
          runId,
          timestamp: Date.now(),
          result: resultData,
        });
      } else {
        await this.markRunFailed(runId, result.error ?? 'Unknown recipe failure');
      }
    } catch (err) {
      await this.markRunFailed(
        runId,
        err instanceof Error ? err.message : 'Unknown runtime error',
      );
    } finally {
      // Clean up
      caster.stop();
      broker.destroy();
      await page.close().catch(() => {});
      await context.close().catch(() => {});
      this.activeRuns.delete(runId);

      logger.info(
        { event: 'worker.run_finished', runId, durationMs: Date.now() - runStart },
        'automation run completed',
      );
    }
  }

  /**
   * Supply a handoff value to a running automation.
   */
  resolveHandoff(runId: string, handoffId: string, value: string): boolean {
    const run = this.activeRuns.get(runId);
    if (!run) return false;
    return run.broker.resolveHandoff({ handoffId, value });
  }

  /**
   * Force abort a running automation.
   */
  async abortRun(runId: string): Promise<boolean> {
    const run = this.activeRuns.get(runId);
    if (!run) return false;

    // Destroying the broker rejects pending handoffs, crashing the recipe gracefully
    run.broker.destroy();
    run.caster.stop();
    await run.context.close().catch(() => {});
    this.activeRuns.delete(runId);

    await AutomationRun.findByIdAndUpdate(runId, {
      status: 'aborted',
      finishedAt: new Date(),
      error: 'Aborted by user',
    }).exec();

    this.emit('event', { kind: 'run_aborted', runId, timestamp: Date.now() });
    return true;
  }

  private async markRunFailed(runId: string, error: string): Promise<void> {
    await AutomationRun.findByIdAndUpdate(runId, {
      status: 'failed',
      finishedAt: new Date(),
      error,
    }).exec();
    this.emit('event', { kind: 'run_failed', runId, timestamp: Date.now(), error });
  }

  /**
   * Graceful shutdown. Waits for active runs to finish (or aborts if taking too long).
   */
  async shutdown(): Promise<void> {
    this.shuttingDown = true;

    if (this.activeRuns.size > 0) {
      logger.info(
        { event: 'worker.shutdown_drain', activeRuns: this.activeRuns.size },
        'draining active runs',
      );
      // Abort all active runs for safety (cannot pause mid-transaction reliably yet)
      const runIds = Array.from(this.activeRuns.keys());
      for (const runId of runIds) {
        await this.abortRun(runId);
      }
    }

    if (this.browserPromise) {
      const browser = await this.browserPromise;
      await browser.close().catch(() => {});
      this.browserPromise = null;
    }
  }

  getActiveRunCount(): number {
    return this.activeRuns.size;
  }
}

// Global singleton worker
export const automationWorker = new AutomationWorker();
