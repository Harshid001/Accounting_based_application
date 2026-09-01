import { Router } from 'express';

import * as controller from '../controllers/compliance.controller.js';
import {
  bulkLimiter,
  exportLimiter,
  mutationLimiter,
  readLimiter,
} from '../middleware/rateLimit.js';
import {
  requireClientScope,
  requireResolvedClientScope,
} from '../middleware/requireClientScope.js';
import { requireCapability } from '../middleware/requireRole.js';
import { handle } from '../middleware/validate.js';
import { clientIdOfItem } from '../services/compliance.service.js';
import { idParam } from '../validators/common.validators.js';
import {
  complianceExportQuery,
  complianceListQuery,
  complianceStatusBody,
  createComplianceBody,
  generateBody,
  updateComplianceBody,
} from '../validators/compliance.validators.js';

export const complianceRouter: Router = Router();

const scopeViaItem = requireResolvedClientScope(clientIdOfItem);

complianceRouter.get(
  '/',
  readLimiter,
  requireCapability('compliance:read'),
  handle({ query: complianceListQuery }, controller.list),
);

complianceRouter.get(
  '/export',
  exportLimiter,
  requireCapability('compliance:export'),
  handle({ query: complianceExportQuery }, controller.exportCsv),
);

complianceRouter.post(
  '/generate/preview',
  bulkLimiter,
  requireCapability('compliance:bulk'),
  handle({ body: generateBody }, controller.preview),
);

complianceRouter.post(
  '/generate',
  bulkLimiter,
  requireCapability('compliance:bulk'),
  handle({ body: generateBody }, controller.generate),
);

complianceRouter.post(
  '/',
  mutationLimiter,
  requireCapability('compliance:create'),
  requireClientScope('body:clientId'),
  handle({ body: createComplianceBody }, controller.create),
);

complianceRouter.get(
  '/:id',
  readLimiter,
  requireCapability('compliance:read'),
  scopeViaItem,
  handle({ params: idParam }, controller.detail),
);

complianceRouter.patch(
  '/:id',
  mutationLimiter,
  requireCapability('compliance:update'),
  scopeViaItem,
  handle(
    {
      params: idParam,
      body: updateComplianceBody,
      rejectBodyKeys: ['status', 'client', 'clientId', 'complianceTypeId'],
    },
    controller.update,
  ),
);

complianceRouter.post(
  '/:id/status',
  mutationLimiter,
  requireCapability('compliance:status'),
  scopeViaItem,
  handle({ params: idParam, body: complianceStatusBody }, controller.changeStatus),
);

complianceRouter.delete(
  '/:id',
  mutationLimiter,
  requireCapability('compliance:delete'),
  scopeViaItem,
  handle({ params: idParam }, controller.remove),
);
