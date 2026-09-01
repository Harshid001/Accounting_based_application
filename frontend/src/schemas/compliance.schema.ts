import { z } from 'zod';

import { COMPLIANCE_STATUSES, PERIOD_TYPES } from '@/types/enums';

const requiredDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.');

const optionalDate = z
  .string()
  .trim()
  .refine(
    (value) => value.length === 0 || /^\d{4}-\d{2}-\d{2}$/.test(value),
    'Enter a date like 29 Jul 2026.',
  );

export const complianceCreateSchema = z.object({
  clientId: z.string().trim().min(1, 'Choose the client this filing belongs to.'),
  complianceTypeId: z.string().trim().min(1, 'Choose which filing this is.'),
  periodType: z.enum(PERIOD_TYPES),
  periodAnchor: requiredDate,
  dueDate: optionalDate,
  assignedStaff: z.string().trim(),
  notes: z.string().trim().max(4000, 'Keep notes under 4000 characters.'),
});
export type ComplianceCreateValues = z.infer<typeof complianceCreateSchema>;

export const emptyComplianceCreate: ComplianceCreateValues = {
  clientId: '',
  complianceTypeId: '',
  periodType: 'month',
  periodAnchor: '',
  dueDate: '',
  assignedStaff: '',
  notes: '',
};

export const complianceEditSchema = z.object({
  dueDate: optionalDate,
  assignedStaff: z.string().trim(),
  notes: z.string().trim().max(4000, 'Keep notes under 4000 characters.'),
  acknowledgementRef: z.string().trim().max(120, 'Keep this under 120 characters.'),
});
export type ComplianceEditValues = z.infer<typeof complianceEditSchema>;

export const complianceStatusSchema = z
  .object({
    status: z.enum(COMPLIANCE_STATUSES),
    filedDate: optionalDate,
    notApplicableReason: z.string().trim().max(500, 'Keep the reason under 500 characters.'),
  })
  .superRefine((value, ctx) => {
    if ((value.status === 'filed' || value.status === 'acknowledged') && value.filedDate.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['filedDate'],
        message: 'Enter the date the return was filed.',
      });
    }
    if (value.status === 'not_applicable' && value.notApplicableReason.trim().length < 3) {
      ctx.addIssue({
        code: 'custom',
        path: ['notApplicableReason'],
        message: 'Say why this filing does not apply. A short reason is enough.',
      });
    }
  });
export type ComplianceStatusValues = z.infer<typeof complianceStatusSchema>;

export const generateSchema = z
  .object({
    complianceTypeId: z.string().trim().min(1, 'Choose which filing to generate.'),
    periodStart: requiredDate,
    periodEnd: requiredDate,
    clientIds: z.array(z.string()),
  })
  .superRefine((value, ctx) => {
    if (value.periodEnd < value.periodStart) {
      ctx.addIssue({
        code: 'custom',
        path: ['periodEnd'],
        message: 'The end of the range must fall on or after its start.',
      });
    }
  });
export type GenerateValues = z.infer<typeof generateSchema>;
