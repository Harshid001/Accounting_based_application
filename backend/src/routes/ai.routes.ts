import { Router } from 'express';

import * as controller from '../controllers/ai.controller.js';
import { aiLimiter, mutationLimiter, readLimiter } from '../middleware/rateLimit.js';
import { requireCapability } from '../middleware/requireRole.js';
import { handle } from '../middleware/validate.js';
import { aiChatBody, aiConfigBody, aiModelsBody } from '../validators/ai.validators.js';

export const aiRouter: Router = Router();

aiRouter.post(
  '/chat',
  aiLimiter,
  requireCapability('ai:chat', { allowUnlinked: true }),
  handle({ body: aiChatBody }, controller.chat),
);

aiRouter.get(
  '/config',
  readLimiter,
  requireCapability('ai:config'),
  handle({}, controller.readConfig),
);

aiRouter.patch(
  '/config',
  mutationLimiter,
  requireCapability('ai:config'),
  handle({ body: aiConfigBody }, controller.updateConfig),
);

aiRouter.post(
  '/models',
  readLimiter,
  requireCapability('ai:config'),
  handle({ body: aiModelsBody }, controller.listModels),
);
