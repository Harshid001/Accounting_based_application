import { z } from 'zod';
import { idParam } from './common.validators.js';
import { AUTOMATION_RUN_MODES } from '../lib/enums.js';

export const automationRunParam = idParam;

export const startRunBody = z.object({
  filingPreparationId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid filing ID.'),
  mode: z.enum(AUTOMATION_RUN_MODES).optional(),
});

export const handoffBody = z.object({
  handoffId: z.string().trim().min(1),
  value: z.string().min(1, 'Value is required'),
});

export type StartRunBody = z.infer<typeof startRunBody>;
export type HandoffBody = z.infer<typeof handoffBody>;
