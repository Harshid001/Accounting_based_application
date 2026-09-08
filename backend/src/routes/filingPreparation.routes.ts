import { Router } from 'express';

import * as controller from '../controllers/filingPreparation.controller.js';
import { mutationLimiter, readLimiter } from '../middleware/rateLimit.js';
import { requireResolvedClientScope } from '../middleware/requireClientScope.js';
import { requireCapability } from '../middleware/requireRole.js';
import { handle } from '../middleware/validate.js';
import { clientIdOfItem } from '../services/compliance.service.js';
import { idParam } from '../validators/common.validators.js';
import {
  gatewaySubmitBody,
  guideStepBody,
} from '../validators/filingPreparation.validators.js';

export const filingPreparationRouter: Router = Router();

const scopeViaItem = requireResolvedClientScope(clientIdOfItem);

filingPreparationRouter.post(
  '/:id/prepare',
  mutationLimiter,
  requireCapability('compliance:update'),
  scopeViaItem,
  handle({ params: idParam }, controller.prepare),
);

filingPreparationRouter.get(
  '/:id',
  readLimiter,
  requireCapability('compliance:read'),
  scopeViaItem,
  handle({ params: idParam }, controller.detail),
);

filingPreparationRouter.get(
  '/:id/download',
  readLimiter,
  requireCapability('compliance:read'),
  scopeViaItem,
  handle({ params: idParam }, controller.downloadPayload),
);

filingPreparationRouter.post(
  '/:id/guide-step',
  mutationLimiter,
  requireCapability('compliance:update'),
  scopeViaItem,
  handle({ params: idParam, body: guideStepBody }, controller.updateStep),
);

filingPreparationRouter.post(
  '/:id/lock',
  mutationLimiter,
  requireCapability('compliance:update'),
  scopeViaItem,
  handle({ params: idParam }, controller.lock),
);

filingPreparationRouter.post(
  '/:id/gateway/request-otp',
  mutationLimiter,
  requireCapability('compliance:update'),
  scopeViaItem,
  handle({ params: idParam }, controller.requestGatewayOtp),
);

filingPreparationRouter.post(
  '/:id/gateway/submit',
  mutationLimiter,
  requireCapability('compliance:update'),
  scopeViaItem,
  handle({ params: idParam, body: gatewaySubmitBody }, controller.submitGatewayReturn),
);
