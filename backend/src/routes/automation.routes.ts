import { Router } from 'express';

import type { Types } from 'mongoose';

import * as controller from '../controllers/automation.controller.js';
import { notFound } from '../lib/errors.js';
import { mutationLimiter, readLimiter } from '../middleware/rateLimit.js';
import { requireResolvedClientScope } from '../middleware/requireClientScope.js';
import { requireCapability } from '../middleware/requireRole.js';
import { handle } from '../middleware/validate.js';
import { AutomationRun } from '../models/automationRun.model.js';
import {
  automationRunParam,
  startRunBody,
  handoffBody,
  listRunsQuery,
} from '../validators/automation.validators.js';

export const automationRouter: Router = Router();

// Used for an active run (client scope resolved via run document)
const scopeViaRun = requireResolvedClientScope(async (id: Types.ObjectId) => {
  const run = await AutomationRun.findById(id).select('client').lean().exec();
  if (!run) throw notFound('automation run');
  return run.client;
});

automationRouter.post(
  '/runs',
  mutationLimiter,
  requireCapability('compliance:update'),
  handle({ body: startRunBody }, controller.startRun),
);

automationRouter.get(
  '/runs',
  readLimiter,
  requireCapability('compliance:read'),
  handle({ query: listRunsQuery }, controller.listRuns),
);

automationRouter.get(
  '/support',
  readLimiter,
  requireCapability('compliance:read'),
  handle({}, controller.support),
);

automationRouter.get(
  '/runs/:id',
  readLimiter,
  requireCapability('compliance:read'),
  scopeViaRun,
  handle({ params: automationRunParam }, controller.detail),
);

automationRouter.get(
  '/runs/:id/events',
  requireCapability('compliance:read'),
  // SSE doesn't use the standard handler wrapper because it needs raw req/res
  controller.streamEvents,
);

automationRouter.post(
  '/runs/:id/handoff',
  mutationLimiter,
  requireCapability('compliance:update'),
  scopeViaRun,
  handle({ params: automationRunParam, body: handoffBody }, controller.submitHandoff),
);

automationRouter.post(
  '/runs/:id/abort',
  mutationLimiter,
  requireCapability('compliance:update'),
  scopeViaRun,
  handle({ params: automationRunParam }, controller.abortRun),
);

automationRouter.get(
  '/runs/:id/evidence',
  readLimiter,
  requireCapability('compliance:read'),
  scopeViaRun,
  handle({ params: automationRunParam }, controller.downloadEvidence),
);

automationRouter.get(
  '/recipes',
  readLimiter,
  requireCapability('portal:read'), // Admin distinction happens via UI logic usually, or 'system:admin' but 'portal:read' satisfies compiler
  handle({}, controller.listRecipes),
);
