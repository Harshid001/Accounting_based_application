import type { Request, Response } from 'express';

import { sendData } from '../lib/http.js';
import { notFound, conflict, validationFailed } from '../lib/errors.js';
import type { RouteContext, ValidatedInput } from '../middleware/validate.js';
import { AutomationRun } from '../models/automationRun.model.js';
import { serializeAutomationRun } from '../serializers/automationRun.serializer.js';
import { automationWorker } from '../services/portalAutomation/worker.js';
import { executePortalAutomation, listRunsForUser } from '../services/portalAutomation/automationRun.service.js';
import { getAutomationSupport } from '../services/portalAutomation/automationRun.service.js';
import { buildEvidencePack } from '../services/portalAutomation/evidencePack.js';
import { recordAudit } from '../services/audit.service.js';
import type { StartRunBody, HandoffBody } from '../validators/automation.validators.js';
import type { RunEvent } from '../services/portalAutomation/types.js';

export const startRun = async (
  input: { body: StartRunBody },
  ctx: RouteContext,
): Promise<void> => {
  const run = await executePortalAutomation({
    filingPreparationId: input.body.filingPreparationId,
    user: ctx.user,
    actor: ctx.actor,
    mode: input.body.mode,
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

export const listRuns = async (
  input: { query: { clientId?: string; status?: string; limit?: number } },
  ctx: RouteContext,
): Promise<void> => {
  const runs = await listRunsForUser(ctx.user, {
    clientId: input.query.clientId ?? null,
    status: input.query.status ?? null,
    limit: input.query.limit ?? null,
  });
  sendData(ctx.res, runs.map(serializeAutomationRun));
};

export const support = async (
  _input: ValidatedInput<Record<string, never>>,
  ctx: RouteContext,
): Promise<void> => {
  const view = await getAutomationSupport();
  sendData(ctx.res, view);
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

export const listRecipes = async (
  _input: ValidatedInput<Record<string, never>>,
  ctx: RouteContext,
): Promise<void> => {
  const { listRecipes: list } = await import('../services/portalAutomation/recipeEngine.js');
  const recipes = await list();
  sendData(ctx.res, recipes);
};
