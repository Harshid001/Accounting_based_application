import { Router } from 'express';

import * as controller from '../controllers/document.controller.js';
import { mutationLimiter, readLimiter, uploadLimiter } from '../middleware/rateLimit.js';
import {
  requireClientScope,
  requireResolvedClientScope,
} from '../middleware/requireClientScope.js';
import { requireCapability } from '../middleware/requireRole.js';
import { handle } from '../middleware/validate.js';
import { clientIdOfDocument } from '../services/document.service.js';
import { idParam } from '../validators/common.validators.js';
import {
  documentListQuery,
  documentPatchBody,
  downloadQuery,
  finaliseBody,
  hardDeleteBody,
  presignBody,
  versionBody,
} from '../validators/document.validators.js';

export const documentRouter: Router = Router();

const scopeViaDocument = requireResolvedClientScope(clientIdOfDocument);

documentRouter.post(
  '/presign-upload',
  uploadLimiter,
  requireCapability('document:presign'),
  requireClientScope('body:clientId'),
  handle({ body: presignBody }, controller.presign),
);

documentRouter.post(
  '/',
  mutationLimiter,
  requireCapability('document:write'),
  requireClientScope('body:clientId'),
  handle({ body: finaliseBody, rejectBodyKeys: ['uploadedByRole', 'versions'] }, controller.finalise),
);

documentRouter.get(
  '/',
  readLimiter,
  requireCapability('document:read'),
  handle({ query: documentListQuery }, controller.list),
);

documentRouter.get(
  '/:id',
  readLimiter,
  requireCapability('document:read'),
  scopeViaDocument,
  handle({ params: idParam }, controller.detail),
);

documentRouter.get(
  '/:id/download',
  readLimiter,
  requireCapability('document:read'),
  scopeViaDocument,
  handle({ params: idParam, query: downloadQuery }, controller.download),
);

documentRouter.post(
  '/:id/versions',
  mutationLimiter,
  requireCapability('document:version'),
  scopeViaDocument,
  handle({ params: idParam, body: versionBody }, controller.addNewVersion),
);

documentRouter.patch(
  '/:id',
  mutationLimiter,
  requireCapability('document:update'),
  scopeViaDocument,
  handle({ params: idParam, body: documentPatchBody }, controller.patch),
);

documentRouter.post(
  '/:id/archive',
  mutationLimiter,
  requireCapability('document:archive'),
  scopeViaDocument,
  handle({ params: idParam }, controller.archive),
);

documentRouter.post(
  '/:id/restore',
  mutationLimiter,
  requireCapability('document:archive'),
  scopeViaDocument,
  handle({ params: idParam }, controller.restore),
);

documentRouter.delete(
  '/:id',
  mutationLimiter,
  requireCapability('document:hard_delete'),
  scopeViaDocument,
  handle({ params: idParam, body: hardDeleteBody }, controller.remove),
);
