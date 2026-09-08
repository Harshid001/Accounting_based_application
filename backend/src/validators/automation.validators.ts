import { z } from 'zod';
import { idParam } from './common.validators.js';
import { AUTOMATION_RUN_MODES, AUTOMATION_RUN_STATUSES } from '../lib/enums.js';

export const automationRunParam = idParam;

export const startRunBody = z.object({
  filingPreparationId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid filing ID.'),
  mode: z.enum(AUTOMATION_RUN_MODES).optional(),
});

export const handoffBody = z.object({
  handoffId: z.string().trim().min(1),
  value: z.string().min(1, 'Value is required'),
});

export const listRunsQuery = z.object({
  clientId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'Invalid client ID.')
    .optional(),
  status: z.enum(AUTOMATION_RUN_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type StartRunBody = z.infer<typeof startRunBody>;
export type HandoffBody = z.infer<typeof handoffBody>;
export type ListRunsQuery = z.infer<typeof listRunsQuery>;
