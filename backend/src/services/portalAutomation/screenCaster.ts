// ---------------------------------------------------------------------------
// Screen Caster — throttled JPEG capture from Playwright page → SSE streams
//
// Captures screenshots from the active browser page at a configurable FPS
// (default: 1 fps to keep bandwidth manageable). Frames are pushed to
// registered SSE channels. Only active while a run is in progress.
// ---------------------------------------------------------------------------

import { EventEmitter } from 'node:events';
import type { Page } from 'playwright';

import { logger } from '../../config/logger.js';

const DEFAULT_FPS = 1;
const DEFAULT_QUALITY = 40; // JPEG quality (0-100)

export interface ScreenCasterOptions {
  fps?: number;
  quality?: number;
  width?: number;
}

/**
 * Captures throttled JPEG screenshots from a Playwright page.
 * Emits 'frame' events with base64-encoded JPEG data.
 */
export class ScreenCaster extends EventEmitter {
  private interval: ReturnType<typeof setInterval> | null = null;
  private capturing = false;
  private readonly fps: number;
  private readonly quality: number;

  constructor(options: ScreenCasterOptions = {}) {
    super();
    this.fps = Math.max(0.1, Math.min(5, options.fps ?? DEFAULT_FPS));
    this.quality = Math.max(10, Math.min(100, options.quality ?? DEFAULT_QUALITY));
  }

  /**
   * Start capturing frames from the given page.
   */
  start(page: Page): void {
    if (this.interval) return;

    const intervalMs = Math.round(1000 / this.fps);
    this.capturing = true;

    this.interval = setInterval(() => {
      if (!this.capturing) return;

      void this.captureFrame(page).catch((error) => {
        // Page might have navigated or closed — not critical
        logger.debug(
          { event: 'screencaster.frame_error', err: error },
          'screenshot capture failed (page may be navigating)',
        );
      });
    }, intervalMs);

    logger.debug(
      { event: 'screencaster.started', fps: this.fps, intervalMs },
      'screen capture started',
    );
  }

  /**
   * Capture a single frame (used internally and for on-demand step screenshots).
   */
  async captureFrame(page: Page): Promise<Buffer | null> {
    try {
      const buffer = await page.screenshot({
        type: 'jpeg',
        quality: this.quality,
        fullPage: false,
      });

      const base64 = buffer.toString('base64');
      this.emit('frame', base64);
      return buffer;
    } catch {
      return null;
    }
  }

  /**
   * Take a high-quality screenshot for evidence/step records.
   */
  async captureEvidence(page: Page): Promise<Buffer | null> {
    try {
      return await page.screenshot({
        type: 'jpeg',
        quality: 80,
        fullPage: false,
      });
    } catch {
      return null;
    }
  }

  /**
   * Pause frame capture (handoff waiting, etc.)
   */
  pause(): void {
    this.capturing = false;
  }

  /**
   * Resume frame capture.
   */
  resume(): void {
    this.capturing = true;
  }

  /**
   * Stop capturing and clean up.
   */
  stop(): void {
    this.capturing = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.removeAllListeners();
    logger.debug({ event: 'screencaster.stopped' }, 'screen capture stopped');
  }
}
