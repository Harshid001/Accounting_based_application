import { Router } from 'express';

import * as controller from '../controllers/client.controller.js';
import * as services from '../controllers/clientService.controller.js';
import * as messages from '../controllers/message.controller.js';
import { exportLimiter, mutationLimiter, readLimiter, revealLimiter } from '../middleware/rateLimit.js';
import {
  requireClientScope,
  requireResolvedClientScope,
} from '../middleware/requireClientScope.js';
import { requireCapability } from '../middleware/requireRole.js';
import { handle } from '../middleware/validate.js';
import { clientIdOfService } from '../services/clientService.service.js';
import {
  activityQuery,
  assignmentsBody,
  clientExportQuery,
  clientListQuery,
  createClientBody,
  updateClientBody,
} from '../validators/client.validators.js';
import {
  createClientServiceBody,
  updateClientServiceBody,
} from '../validators/clientService.validators.js';
import { idParam } from '../validators/common.validators.js';
import { messageListQuery, postMessageBody } from '../validators/message.validators.js';

const PRIVILEGED_CLIENT_FIELDS = [
  'clientType',
  'status',
  'pan',
  'gstin',
  'tan',
  'cin',
  'aadhaar',
  'entityType',
  'incorporationDate',
  'dateOfBirth',
  'assignedStaff',
] as const;

export const clientRouter: Router = Router();

clientRouter.get(
  '/',
  readLimiter,
  requireCapability('client:read'),
  handle({ query: clientListQuery }, controller.list),
);

clientRouter.get(
  '/export',
  exportLimiter,
  requireCapability('client:export'),
  handle({ query: clientExportQuery }, controller.exportCsv),
);

clientRouter.post(
  '/',
  mutationLimiter,
  requireCapability('client:create'),
  handle({ body: createClientBody, rejectBodyKeys: ['archived', 'createdBy'] }, controller.create),
);

clientRouter.get(
  '/:id',
  readLimiter,
  requireCapability('client:read'),
  requireClientScope('param:id'),
  handle({ params: idParam }, controller.detail),
);

clientRouter.patch(
  '/:id',
  mutationLimiter,
  requireCapability('client:update'),
  requireClientScope('param:id'),
  handle(
    {
      params: idParam,
      body: updateClientBody,
      rejectBodyKeys: ['archived', 'createdBy'],
      adminOnlyBodyKeys: PRIVILEGED_CLIENT_FIELDS,
    },
    controller.update,
  ),
);

clientRouter.post(
  '/:id/archive',
  mutationLimiter,
  requireCapability('client:archive'),
  requireClientScope('param:id'),
  handle({ params: idParam }, controller.archive),
);

clientRouter.post(
  '/:id/restore',
  mutationLimiter,
  requireCapability('client:archive'),
  requireClientScope('param:id'),
  handle({ params: idParam }, controller.restore),
);

clientRouter.put(
  '/:id/assignments',
  mutationLimiter,
  requireCapability('client:assign_staff'),
  requireClientScope('param:id'),
  handle({ params: idParam, body: assignmentsBody }, controller.assign),
);

clientRouter.post(
  '/:id/pin',
  mutationLimiter,
  requireCapability('client:pin'),
  requireClientScope('param:id'),
  handle({ params: idParam }, controller.pin),
);

clientRouter.delete(
  '/:id/pin',
  mutationLimiter,
  requireCapability('client:pin'),
  requireClientScope('param:id'),
  handle({ params: idParam }, controller.unpin),
);

clientRouter.post(
  '/:id/aadhaar/reveal',
  revealLimiter,
  requireCapability('client:reveal_aadhaar'),
  requireClientScope('param:id'),
  handle({ params: idParam }, controller.reveal),
);

clientRouter.get(
  '/:id/activity',
  readLimiter,
  requireCapability('client:read'),
  requireClientScope('param:id'),
  handle({ params: idParam, query: activityQuery }, controller.activity),
);

clientRouter.get(
  '/:id/services',
  readLimiter,
  requireCapability('client_service:read'),
  requireClientScope('param:id'),
  handle({ params: idParam }, services.list),
);

clientRouter.post(
  '/:id/services',
  mutationLimiter,
  requireCapability('client_service:write'),
  requireClientScope('param:id'),
  handle({ params: idParam, body: createClientServiceBody }, services.create),
);

clientRouter.get(
  '/:id/messages',
  readLimiter,
  requireCapability('message:read'),
  requireClientScope('param:id'),
  handle({ params: idParam, query: messageListQuery }, messages.list),
);

clientRouter.post(
  '/:id/messages',
  mutationLimiter,
  requireCapability('message:write'),
  requireClientScope('param:id'),
  handle({ params: idParam, body: postMessageBody }, messages.create),
);

export const clientServiceRouter: Router = Router();

const scopeViaService = requireResolvedClientScope(clientIdOfService);

clientServiceRouter.patch(
  '/:id',
  mutationLimiter,
  requireCapability('client_service:write'),
  scopeViaService,
  handle({ params: idParam, body: updateClientServiceBody }, services.update),
);

clientServiceRouter.delete(
  '/:id',
  mutationLimiter,
  requireCapability('client_service:delete'),
  scopeViaService,
  handle({ params: idParam }, services.remove),
);
