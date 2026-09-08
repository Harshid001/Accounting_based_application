// ---------------------------------------------------------------------------
// Handoff Broker — in-memory, ephemeral channel for human-supplied secrets
//
// Secrets (passwords, OTPs, CAPTCHA answers, typed confirmations) live ONLY
// in memory, with TTL enforcement. They are NEVER persisted, logged, or
// returned in any API response. Only the recipe engine reads the resolved
// value, types it into the page, and discards it.
// ---------------------------------------------------------------------------

import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';

import { logger } from '../../config/logger.js';
import type { HandoffType } from '../../lib/enums.js';
import type { HandoffDescriptor, HandoffResolution } from './types.js';

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface PendingHandoff {
  descriptor: HandoffDescriptor;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Manages the human-handoff lifecycle for a single automation run.
 * Each run gets its own broker instance — when the run ends, `destroy()`
 * cleans up all pending handoffs.
 */
export class HandoffBroker extends EventEmitter {
  private readonly pending = new Map<string, PendingHandoff>();
  private destroyed = false;

  /**
   * Request a handoff from the human operator.
   * Returns a promise that resolves with the secret value when the human
   * supplies it, or rejects on timeout / run abort.
   */
  requestHandoff(
    type: HandoffType,
    prompt: string,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): { descriptor: HandoffDescriptor; valuePromise: Promise<string> } {
    if (this.destroyed) {
      throw new Error('HandoffBroker has been destroyed');
    }

    const handoffId = `hoff_${Date.now()}_${randomBytes(4).toString('hex')}`;
    const descriptor: HandoffDescriptor = { handoffId, type, prompt, timeoutMs };

    const valuePromise = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(handoffId);
        reject(new Error(`Handoff "${handoffId}" timed out after ${timeoutMs}ms`));
        this.emit('timeout', handoffId);
      }, timeoutMs);

      this.pending.set(handoffId, { descriptor, resolve, reject, timer });
    });

    this.emit('requested', descriptor);
    logger.debug(
      { event: 'handoff.requested', handoffId, type },
      'handoff requested from human operator',
    );

    return { descriptor, valuePromise };
  }

  /**
   * Supply the human-provided value for a pending handoff.
   * The value is passed directly to the recipe engine and is NEVER stored.
   */
  resolveHandoff(resolution: HandoffResolution): boolean {
    const entry = this.pending.get(resolution.handoffId);
    if (!entry) {
      logger.warn(
        { event: 'handoff.resolve_miss', handoffId: resolution.handoffId },
        'attempted to resolve a non-existent or expired handoff',
      );
      return false;
    }

    clearTimeout(entry.timer);
    this.pending.delete(resolution.handoffId);
    entry.resolve(resolution.value);
    this.emit('resolved', resolution.handoffId);

    // Intentionally NOT logging the value
    logger.debug(
      { event: 'handoff.resolved', handoffId: resolution.handoffId },
      'handoff resolved by human operator',
    );

    return true;
  }

  /**
   * Check if a handoff is currently pending.
   */
  isPending(handoffId: string): boolean {
    return this.pending.has(handoffId);
  }

  /**
   * Get all currently pending handoff descriptors (safe — no values exposed).
   */
  getPendingDescriptors(): HandoffDescriptor[] {
    return Array.from(this.pending.values()).map((entry) => entry.descriptor);
  }

  /**
   * Reject all pending handoffs and clean up timers.
   * Called when a run ends (success, failure, or abort).
   */
  destroy(): void {
    this.destroyed = true;
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error('Automation run ended'));
      this.pending.delete(id);
    }
    this.removeAllListeners();
  }
}
