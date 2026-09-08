import { Types } from 'mongoose';
import type { Request, Response } from 'express';

import { logger } from '../config/logger.js';
import { sendData } from '../lib/http.js';
import { notFound, conflict, validationFailed } from '../lib/errors.js';
import type { RouteContext } from '../middleware/validate.js';
import { AutomationRun } from '../models/automationRun.model.js';
import { FilingPreparation } from '../models/filingPreparation.model.js';
import { serializeAutomationRun } from '../serializers/automationRun.serializer.js';
import { automationWorker } from '../services/portalAutomation/worker.js';
import { loadRecipe } from '../services/portalAutomation/recipeEngine.js';
import { buildEvidencePack } from '../services/portalAutomation/evidencePack.js';
import { recordAudit } from '../services/audit.service.js';
import type { StartRunBody, HandoffBody } from '../validators/automation.validators.js';
import { getPreparation } from '../services/filingPreparation.service.js';
import type { RunEvent } from '../services/portalAutomation/types.js';

export const startRun = async (
  input: { body: StartRunBody },
  ctx: RouteContext,
): Promise<void> => {
  const prepId = new Types.ObjectId(input.body.filingPreparationId);
  const prep = await FilingPreparation.findById(prepId).exec();
  if (!prep) throw notFound('filing preparation');

  if (prep.status !== 'ready' && prep.status !== 'locked') {
    throw conflict('Filing is not ready. Resolve missing inputs first.');
  }

  // Load recipe
  const recipe = await loadRecipe(prep.portalName ?? 'gst', prep.formCode);

  // Re-fetch fully populated prep
  const fullPrep = await getPreparation(ctx.user, prep.complianceItem);

  // Check worker capacity
  if (automationWorker.getActiveRunCount() >= 2) {
    throw conflict('Worker is at capacity. Please wait for an active run to finish.');
  }

  const run = await AutomationRun.create({
    client: prep.client,
    complianceItem: prep.complianceItem,
    filingPreparation: prep._id,
    portal: recipe.portal,
    form: recipe.form,
    mode: input.body.mode ?? 'recipe',
    status: 'queued',
    recipeVersion: recipe.version,
    initiatedBy: ctx.user.id,
    actorRole: ctx.user.role,
    steps: recipe.steps.map((s) => ({
      key: s.key,
      label: s.label ?? s.key,
      status: 'pending',
    })),
  });

  const runId = run._id.toString();

  await recordAudit({
    actor: ctx.actor,
    action: 'automation_start',
    entityKind: 'automationRun',
    entityId: run._id,
    client: prep.client,
    summary: `Started automation run for ${recipe.form} on ${recipe.portal}`,
  });

  // Start worker in background
  automationWorker
    .startRun({
      runId,
      clientId: prep.client.toString(),
      filingPreparationId: prep._id.toString(),
      recipe,
      portalPayload: fullPrep.portalPayload ?? {},
      computed: fullPrep.computed,
      mode: run.mode,
    })
    .catch((err) => {
      logger.error({ event: 'automation.start_failed', err }, 'failed to start worker run');
    });

  sendData(ctx.res, serializeAutomationRun(run));
};

export const detail = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  const run = await AutomationRun.findById(input.params.id).exec();
  if (!run) throw notFound('automation run');

  sendData(ctx.res, serializeAutomationRun(run));
};

export const abortRun = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  const run = await AutomationRun.findById(input.params.id).exec();
  if (!run) throw notFound('automation run');

  if (run.status === 'succeeded' || run.status === 'failed' || run.status === 'aborted') {
    throw conflict(`Run is already ${run.status}`);
  }

  await automationWorker.abortRun(run._id.toString());

  await recordAudit({
    actor: ctx.actor,
    action: 'automation_abort',
    entityKind: 'automationRun',
    entityId: run._id,
    client: run.client,
    summary: 'Aborted automation run',
  });

  sendData(ctx.res, { success: true });
};

export const submitHandoff = async (
  input: { params: { id: string }; body: HandoffBody },
  ctx: RouteContext,
): Promise<void> => {
  const run = await AutomationRun.findById(input.params.id).exec();
  if (!run) throw notFound('automation run');

  const resolved = automationWorker.resolveHandoff(
    run._id.toString(),
    input.body.handoffId,
    input.body.value,
  );

  if (!resolved) {
    throw validationFailed('Invalid or expired handoff ID', [
      { field: 'handoffId', message: 'Handoff expired or already resolved' },
    ]);
  }

  await recordAudit({
    actor: ctx.actor,
    action: 'automation_handoff',
    entityKind: 'automationRun',
    entityId: run._id,
    client: run.client,
    summary: 'Resolved human handoff',
  });

  sendData(ctx.res, { success: true });
};

export const downloadEvidence = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  // Can only download evidence for finished runs
  const run = await AutomationRun.findById(input.params.id).exec();
  if (!run) throw notFound('automation run');

  if (run.status === 'queued' || run.status === 'starting' || run.status === 'running') {
    throw conflict('Evidence pack is only available after the run finishes');
  }

  const { stream, filename } = await buildEvidencePack(run._id.toString());

  ctx.res.setHeader('Content-Type', 'application/zip');
  ctx.res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  ctx.res.setHeader('X-Content-Type-Options', 'nosniff');

  stream.pipe(ctx.res);
};

export const streamEvents = (req: Request, res: Response): void => {
  const runId = req.params.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const handleEvent = (event: RunEvent) => {
    if (event.runId === runId) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };

  automationWorker.on('event', handleEvent);

  req.on('close', () => {
    automationWorker.off('event', handleEvent);
  });
};

import type { ValidatedInput } from '../middleware/validate.js';

export const listRecipes = async (
  _input: ValidatedInput<Record<string, never>>,
  ctx: RouteContext,
): Promise<void> => {
  const { listRecipes: list } = await import('../services/portalAutomation/recipeEngine.js');
  const recipes = await list();
  sendData(ctx.res, recipes);
};
