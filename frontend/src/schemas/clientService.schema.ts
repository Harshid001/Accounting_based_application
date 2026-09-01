import { z } from 'zod';

import { FREQUENCIES } from '@/types/enums';

const optionalDate = z
  .string()
  .trim()
  .refine(
    (value) => value.length === 0 || /^\d{4}-\d{2}-\d{2}$/.test(value),
    'Enter a date like 29 Jul 2026.',
  );

export const clientServiceSchema = z
  .object({
    complianceTypeId: z.string().trim().min(1, 'Choose which filing this service covers.'),
    frequency: z.union([z.enum(FREQUENCIES), z.literal('')]),
    startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date this service starts.'),
    endDate: optionalDate,
    assignedStaff: z.string().trim(),
    active: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.endDate.length > 0 && value.endDate < value.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'The end date must fall on or after the start date.',
      });
    }
  });

export type ClientServiceValues = z.infer<typeof clientServiceSchema>;

export const emptyClientService: ClientServiceValues = {
  complianceTypeId: '',
  frequency: '',
  startDate: '',
  endDate: '',
  assignedStaff: '',
  active: true,
};

export const toClientServicePayload = (
  values: ClientServiceValues,
  options: { includeType: boolean },
): Record<string, unknown> => ({
  ...(options.includeType ? { complianceTypeId: values.complianceTypeId } : {}),
  frequency: values.frequency.length === 0 ? null : values.frequency,
  startDate: values.startDate,
  endDate: values.endDate.length === 0 ? null : values.endDate,
  assignedStaff: values.assignedStaff.length === 0 ? null : values.assignedStaff,
  active: values.active,
});
