// ---------------------------------------------------------------------------
// Recipe Engine — loads declarative recipe JSON, executes steps against a
// Playwright Page, emits RunEvents, handles handoffs via the broker.
//
// Core design: deterministic recipes drive the browser. The LLM never
// freestyle-drives — it can only orchestrate at a higher level. Destructive
// actions (FILE/SUBMIT/PAY) require human-typed confirmation.
// ---------------------------------------------------------------------------

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Page } from 'playwright';

import { logger } from '../../config/logger.js';
import { HandoffBroker } from './handoffBroker.js';
import { ScreenCaster } from './screenCaster.js';
import type { Recipe, RecipeStep, RunEvent, RunEventKind } from './types.js';
import type { HandoffType } from '../../lib/enums.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECIPES_DIR = resolve(__dirname, 'recipes');

const DEFAULT_STEP_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Recipe loading
// ---------------------------------------------------------------------------

/**
 * Load a recipe JSON file from the recipes directory.
 * Path: recipes/<portal>/<form>.json
 */
export const loadRecipe = async (portal: string, form: string): Promise<Recipe> => {
  const filePath = resolve(RECIPES_DIR, portal, `${form}.json`);
  try {
    const raw = await readFile(filePath, 'utf-8');
    const recipe: Recipe = JSON.parse(raw);
    return recipe;
  } catch (error) {
    throw new Error(
      `Recipe not found: ${portal}/${form}.json — ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
};

/**
 * List available recipes by scanning the recipes directory.
 */
export const listRecipes = async (): Promise<
  Array<{ portal: string; form: string; version: number }>
> => {
  const { readdir } = await import('node:fs/promises');
  const recipes: Array<{ portal: string; form: string; version: number }> = [];

  try {
    const portals = await readdir(RECIPES_DIR);
    for (const portal of portals) {
      const portalDir = resolve(RECIPES_DIR, portal);
      const stat = await import('node:fs').then((fs) => fs.statSync(portalDir));
      if (!stat.isDirectory()) continue;

      const files = await readdir(portalDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const raw = await readFile(resolve(portalDir, file), 'utf-8');
          const recipe: Recipe = JSON.parse(raw);
          recipes.push({
            portal: recipe.portal,
            form: recipe.form,
            version: recipe.version,
          });
        } catch {
          // Skip malformed recipe files
        }
      }
    }
  } catch {
    // Recipes directory might not exist yet
  }

  return recipes;
};

// ---------------------------------------------------------------------------
// Data resolution — resolve dot-paths like "computed.section3A.taxableValue"
// ---------------------------------------------------------------------------

const resolvePath = (obj: Record<string, unknown>, path: string): unknown => {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object')
      return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
};

const resolveMapValue = (
  step: RecipeStep,
  portalPayload: Record<string, unknown>,
  computed: Record<string, unknown>,
): string => {
  if (!step.map) return '';

  // Try portalPayload first, then computed, then the combined object
  const combined: Record<string, unknown> = {
    portalPayload,
    computed,
    ...portalPayload,
    ...computed,
  };
  const value = resolvePath(combined, step.map);

  if (value === undefined || value === null) {
    logger.warn(
      { event: 'recipe.map_miss', map: step.map, stepKey: step.key },
      'recipe map path did not resolve to a value',
    );
    return '';
  }

  return String(value);
};

// ---------------------------------------------------------------------------
// Step execution
// ---------------------------------------------------------------------------

export interface RecipeEngineContext {
  page: Page;
  broker: HandoffBroker;
  caster: ScreenCaster;
  portalPayload: Record<string, unknown>;
  computed: Record<string, unknown>;
  runId: string;
  onEvent: (event: RunEvent) => void;
}

const emitEvent = (
  ctx: RecipeEngineContext,
  kind: RunEventKind,
  stepKey: string,
  stepIndex: number,
  extra: Partial<RunEvent> = {},
): void => {
  ctx.onEvent({
    kind,
    runId: ctx.runId,
    timestamp: Date.now(),
    stepKey,
    stepIndex,
    ...extra,
  });
};

const executeNavigate = async (page: Page, step: RecipeStep): Promise<void> => {
  if (!step.url) throw new Error(`navigate step "${step.key}" has no url`);
  await page.goto(step.url, {
    waitUntil: 'domcontentloaded',
    timeout: step.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS,
  });
};

const executeClick = async (page: Page, step: RecipeStep): Promise<void> => {
  const timeout = step.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;

  if (step.role && step.name) {
    await page.getByRole(step.role as any, { name: step.name }).click({ timeout });
  } else if (step.selector) {
    await page.locator(step.selector).click({ timeout });
  } else {
    throw new Error(`click step "${step.key}" needs a selector or role+name`);
  }
};

const executeFill = async (page: Page, step: RecipeStep, value: string): Promise<void> => {
  const timeout = step.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;

  if (step.selector) {
    const locator = page.locator(step.selector);
    await locator.fill(value, { timeout });
  } else if (step.role && step.name) {
    await page.getByRole(step.role as any, { name: step.name }).fill(value, { timeout });
  } else {
    throw new Error(`fill step "${step.key}" needs a selector or role+name`);
  }
};

const executeExtract = async (page: Page, step: RecipeStep): Promise<string | null> => {
  if (!step.regex) throw new Error(`extract step "${step.key}" has no regex`);

  const bodyText = await page.textContent('body', {
    timeout: step.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS,
  });
  if (!bodyText) return null;

  const match = bodyText.match(new RegExp(step.regex));
  return match?.[1] ?? match?.[0] ?? null;
};

const executeWait = async (step: RecipeStep): Promise<void> => {
  const ms = step.waitMs ?? 1000;
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const executeHandoff = async (
  ctx: RecipeEngineContext,
  step: RecipeStep,
  stepIndex: number,
): Promise<string> => {
  const type = step.type as HandoffType;
  if (!type) throw new Error(`handoff step "${step.key}" has no type`);

  let prompt = `Please provide your ${type}`;
  if (step.confirm === 'human' && step.typed) {
    prompt = `Type "${step.typed}" to confirm this action`;
  }

  const { descriptor, valuePromise } = ctx.broker.requestHandoff(
    type,
    prompt,
    step.timeoutMs ?? 5 * 60 * 1000,
  );

  // Emit handoff_required event
  emitEvent(ctx, 'handoff_required', step.key, stepIndex, {
    handoffId: descriptor.handoffId,
    handoffType: type,
    handoffPrompt: prompt,
    stepStatus: 'waiting_human',
  });

  // Pause screen capture while waiting for human
  ctx.caster.pause();

  // Wait for human to supply the value
  const value = await valuePromise;

  // Resume screen capture
  ctx.caster.resume();

  // Emit handoff resolved
  emitEvent(ctx, 'handoff_resolved', step.key, stepIndex, {
    handoffId: descriptor.handoffId,
  });

  // Verify typed confirmation if required
  if (step.confirm === 'human' && step.typed) {
    if (value.trim().toUpperCase() !== step.typed.toUpperCase()) {
      throw new Error(`Confirmation mismatch: expected "${step.typed}", got "${value.trim()}"`);
    }
  }

  return value;
};

// ---------------------------------------------------------------------------
// Main recipe execution loop
// ---------------------------------------------------------------------------

export interface RecipeExecutionResult {
  success: boolean;
  stepsCompleted: number;
  extractedValues: Record<string, string | null>;
  error: string | null;
}

/**
 * Execute a recipe step-by-step against the Playwright page.
 * Emits events for each step transition.
 */
export const executeRecipe = async (
  recipe: Recipe,
  ctx: RecipeEngineContext,
): Promise<RecipeExecutionResult> => {
  const extractedValues: Record<string, string | null> = {};
  let stepsCompleted = 0;

  for (let i = 0; i < recipe.steps.length; i++) {
    const step = recipe.steps[i]!;

    emitEvent(ctx, 'step_start', step.key, i, { stepStatus: 'running' });

    try {
      switch (step.action) {
        case 'navigate':
          await executeNavigate(ctx.page, step);
          break;

        case 'click': {
          // If this is a human-confirmed destructive click, get confirmation first
          if (step.confirm === 'human') {
            await executeHandoff(ctx, step, i);
          }
          await executeClick(ctx.page, step);
          break;
        }

        case 'fill': {
          let value: string;
          if (step.type) {
            // Handoff-fill: the value comes from the human (e.g. typing password into a field)
            value = await executeHandoff(ctx, step, i);
          } else {
            // Data-fill: the value comes from portalPayload/computed
            value = resolveMapValue(step, ctx.portalPayload, ctx.computed);
          }
          await executeFill(ctx.page, step, value);
          break;
        }

        case 'extract': {
          const extracted = await executeExtract(ctx.page, step);
          if (step.map) {
            extractedValues[step.map] = extracted;
          }
          extractedValues[step.key] = extracted;
          break;
        }

        case 'wait':
          await executeWait(step);
          break;

        case 'handoff': {
          const value = await executeHandoff(ctx, step, i);
          // For handoff steps that also need to fill a field (e.g. password → input)
          // the step can have a selector to fill the value into
          if (step.selector) {
            await executeFill(ctx.page, step, value);
          }
          break;
        }

        case 'screenshot': {
          // Explicit screenshot step (evidence capture)
          await ctx.caster.captureEvidence(ctx.page);
          break;
        }

        default:
          throw new Error(`Unknown recipe action: ${step.action}`);
      }

      // Capture evidence screenshot after each successful step
      await ctx.caster.captureEvidence(ctx.page);

      stepsCompleted++;
      emitEvent(ctx, 'step_done', step.key, i, { stepStatus: 'succeeded' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown step failure';

      emitEvent(ctx, 'step_failed', step.key, i, {
        stepStatus: 'failed',
        error: message,
      });

      logger.error(
        { event: 'recipe.step_failed', runId: ctx.runId, stepKey: step.key, err: error },
        'recipe step failed',
      );

      return {
        success: false,
        stepsCompleted,
        extractedValues,
        error: `Step "${step.key}" failed: ${message}`,
      };
    }
  }

  return {
    success: true,
    stepsCompleted,
    extractedValues,
    error: null,
  };
};
