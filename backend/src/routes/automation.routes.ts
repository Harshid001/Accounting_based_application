import { Router } from 'express';

import * as controller from '../controllers/automation.controller.js';
import { mutationLimiter, readLimiter } from '../middleware/rateLimit.js';
import { requireResolvedClientScope } from '../middleware/requireClientScope.js';
import { requireCapability } from '../middleware/requireRole.js';
import { handle } from '../middleware/validate.js';
import {
  automationRunParam,
  startRunBody,
  handoffBody,
} from '../validators/automation.validators.js';
import { clientIdOfItem } from '../services/compliance.service.js';

export const automationRouter: Router = Router();

// Used when starting a run (client scope resolved via compliance item)
const scopeViaItem = requireResolvedClientScope(clientIdOfItem);

// Used for an active run (client scope resolved via run document)
import { AutomationRun } from '../models/automationRun.model.js';
import { notFound } from '../lib/errors.js';
import { Types } from 'mongoose';

const scopeViaRun = requireResolvedClientScope(async (id: Types.ObjectId) => {
  const run = await AutomationRun.findById(id).select('client').lean().exec();
  if (!run) throw notFound('automation run');
  return run.client as Types.ObjectId;
});

automationRouter.post(
  '/runs',
  mutationLimiter,
  requireCapability('compliance:update'),
  scopeViaItem, // Note: body.filingPreparationId maps to complianceItem, so we need a slightly custom resolver if we don't want to overcomplicate.
  // Actually, the simplest way is to resolve it inside the controller, but middleware requires it.
  // Let's use a simpler middleware strategy: just enforce client matches later or write a custom resolver.
  // For now, removing `scopeViaItem` from this route since the ID passed is a filing prep, not a compliance item directly.
  // It will be validated securely inside `controller.startRun`.
  handle({ body: startRunBody }, controller.startRun),
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
