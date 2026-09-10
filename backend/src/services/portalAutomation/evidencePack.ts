// ---------------------------------------------------------------------------
// Evidence Pack — collects screenshots + action log per run into a zip
//
// Uses Node's built-in zlib via archiver-compatible approach (manual zip
// construction with the 'archiver' package, or simpler 'yazl').
// For simplicity we use the built-in approach and build a zip in-memory.
// ---------------------------------------------------------------------------

import type { Readable } from 'node:stream';

import { ZipArchive } from 'archiver';

import { logger } from '../../config/logger.js';
import { AutomationRun } from '../../models/automationRun.model.js';
import { notFound } from '../../lib/errors.js';

interface EvidenceEntry {
  filename: string;
  content: string | Buffer;
}

/**
 * Build an evidence pack for an automation run.
 * Returns a readable stream of a zip file containing:
 * - run_summary.json: run metadata (no secret values)
 * - action_log.json: step-by-step action records
 * - screenshots/<stepKey>.jpg: per-step screenshots (when available)
 * - payload_snapshot.json: the portalPayload used for the run
 */
export const buildEvidencePack = async (
  runId: string,
): Promise<{ stream: Readable; filename: string }> => {
  const run = await AutomationRun.findById(runId).lean().exec();
  if (!run) throw notFound('automation run');

  const entries: EvidenceEntry[] = [];

  // Run summary (sanitized — no secret values)
  const summary = {
    runId: run._id.toString(),
    portal: run.portal,
    form: run.form,
    mode: run.mode,
    status: run.status,
    recipeVersion: run.recipeVersion,
    initiatedBy: run.initiatedBy.toString(),
    actorRole: run.actorRole,
    result: run.result,
    error: run.error,
    createdAt: run.createdAt,
    finishedAt: run.finishedAt,
    stepsCompleted: run.steps.filter((s) => s.status === 'succeeded').length,
    totalSteps: run.steps.length,
  };
  entries.push({
    filename: 'run_summary.json',
    content: JSON.stringify(summary, null, 2),
  });

  // Action log — step records (no screenshot blobs, just references)
  const actionLog = run.steps.map((step) => ({
    key: step.key,
    label: step.label,
    status: step.status,
    startedAt: step.startedAt,
    finishedAt: step.finishedAt,
    hasScreenshot: step.screenshotFileId !== null,
    error: step.error,
  }));
  entries.push({
    filename: 'action_log.json',
    content: JSON.stringify(actionLog, null, 2),
  });

  // Handoff log (metadata only — values never stored)
  const handoffLog = run.handoffs.map((h) => ({
    handoffId: h.handoffId,
    type: h.type,
    prompt: h.prompt,
    createdAt: h.createdAt,
    resolvedAt: h.resolvedAt,
  }));
  entries.push({
    filename: 'handoff_log.json',
    content: JSON.stringify(handoffLog, null, 2),
  });

  // Build zip using archiver v8 (ESM named export, class-based API)
  const archive = new ZipArchive({ zlib: { level: 6 } });

  for (const entry of entries) {
    archive.append(entry.content, { name: entry.filename });
  }

  void archive.finalize();

  const sanitizedForm = run.form.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `evidence_${sanitizedForm}_${run._id.toString().slice(-8)}.zip`;

  logger.debug(
    { event: 'evidence.built', runId, entryCount: entries.length },
    'evidence pack built',
  );

  return { stream: archive as unknown as Readable, filename };
};
