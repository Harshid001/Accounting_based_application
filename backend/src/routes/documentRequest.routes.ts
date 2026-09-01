import { Router } from 'express';

import * as controller from '../controllers/documentRequest.controller.js';
import { mutationLimiter, readLimiter } from '../middleware/rateLimit.js';
import {
  requireClientScope,
  requireResolvedClientScope,
} from '../middleware/requireClientScope.js';
import { requireCapability } from '../middleware/requireRole.js';
import { handle } from '../middleware/validate.js';
import { clientIdOfRequest } from '../services/documentRequest.service.js';
import { idParam } from '../validators/common.validators.js';
import {
  createDocumentRequestBody,
  documentRequestListQuery,
  updateDocumentRequestBody,
} from '../validators/documentRequest.validators.js';

export const documentRequestRouter: Router = Router();

const scopeViaRequest = requireResolvedClientScope(clientIdOfRequest);

documentRequestRouter.get(
  '/',
  readLimiter,
  requireCapability('document_request:read'),
  handle({ query: documentRequestListQuery }, controller.list),
);

documentRequestRouter.post(
  '/',
  mutationLimiter,
  requireCapability('document_request:write'),
  requireClientScope('body:clientId'),
  handle({ body: createDocumentRequestBody }, controller.create),
);

documentRequestRouter.patch(
  '/:id',
  mutationLimiter,
  requireCapability('document_request:write'),
  scopeViaRequest,
  handle(
    { params: idParam, body: updateDocumentRequestBody, rejectBodyKeys: ['status', 'clientId'] },
    controller.update,
  ),
);

documentRequestRouter.post(
  '/:id/cancel',
  mutationLimiter,
  requireCapability('document_request:write'),
  scopeViaRequest,
  handle({ params: idParam }, controller.cancel),
);

documentRequestRouter.post(
  '/:id/remind',
  mutationLimiter,
  requireCapability('document_request:remind'),
  scopeViaRequest,
  handle({ params: idParam }, controller.remind),
);
