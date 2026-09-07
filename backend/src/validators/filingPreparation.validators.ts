import { z } from 'zod';

import { idParam } from './common.validators.js';

export const guideStepBody = z.object({
  stepIndex: z.number().int().min(0).max(49),
  done: z.boolean(),
});

export const filingPreparationParam = idParam;

export type GuideStepBody = z.infer<typeof guideStepBody>;
