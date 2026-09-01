import { Router } from 'express';

import * as controller from '../controllers/complianceType.controller.js';
import { mutationLimiter, readLimiter } from '../middleware/rateLimit.js';
import { requireCapability } from '../middleware/requireRole.js';
import { handle } from '../middleware/validate.js';
import { idParam } from '../validators/common.validators.js';
import {
  complianceTypeListQuery,
  createComplianceTypeBody,
  updateComplianceTypeBody,
} from '../validators/complianceType.validators.js';

export const complianceTypeRouter: Router = Router();

complianceTypeRouter.get(
  '/',
  readLimiter,
  requireCapability('catalogue:read'),
  handle({ query: complianceTypeListQuery }, controller.list),
);

complianceTypeRouter.post(
  '/',
  mutationLimiter,
  requireCapability('catalogue:write'),
  handle({ body: createComplianceTypeBody, rejectBodyKeys: ['isSeeded'] }, controller.create),
);

complianceTypeRouter.get(
  '/:id',
  readLimiter,
  requireCapability('catalogue:read'),
  handle({ params: idParam }, controller.detail),
);

complianceTypeRouter.patch(
  '/:id',
  mutationLimiter,
  requireCapability('catalogue:write'),
  handle(
    { params: idParam, body: updateComplianceTypeBody, rejectBodyKeys: ['isSeeded'] },
    controller.update,
  ),
);

complianceTypeRouter.delete(
  '/:id',
  mutationLimiter,
  requireCapability('catalogue:write'),
  handle({ params: idParam }, controller.remove),
);
