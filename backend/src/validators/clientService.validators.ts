import { z } from 'zod';

import { FREQUENCIES } from '../lib/enums.js';
import { dateOnlyString, nullableDateOnly, objectId } from './common.validators.js';

export const createClientServiceBody = z.object({
  complianceTypeId: objectId,
  frequency: z.union([z.enum(FREQUENCIES), z.null()]).optional(),
  startDate: dateOnlyString,
  endDate: nullableDateOnly,
  assignedStaff: z.union([objectId, z.null()]).optional(),
  active: z.boolean().optional(),
});

export const updateClientServiceBody = z.object({
  frequency: z.union([z.enum(FREQUENCIES), z.null()]).optional(),
  startDate: dateOnlyString.optional(),
  endDate: nullableDateOnly,
  assignedStaff: z.union([objectId, z.null()]).optional(),
  active: z.boolean().optional(),
});

export type CreateClientServiceBody = z.infer<typeof createClientServiceBody>;
export type UpdateClientServiceBody = z.infer<typeof updateClientServiceBody>;
