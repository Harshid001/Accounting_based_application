import { z } from 'zod';

import { idParam } from './common.validators.js';

export const guideStepBody = z.object({
  stepIndex: z.number().int().min(0).max(49),
  done: z.boolean(),
});

export const gatewaySubmitBody = z.object({
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit OTP.'),
  transactionId: z.string().trim().max(100).optional(),
});

export const filingPreparationParam = idParam;

export type GuideStepBody = z.infer<typeof guideStepBody>;
export type GatewaySubmitBody = z.infer<typeof gatewaySubmitBody>;
