import { z } from 'zod';

import { COMPLIANCE_CATEGORIES, DOCUMENT_TYPES, FREQUENCIES } from '../lib/enums.js';
import {
  nullableText,
  optionalBooleanQuery,
  searchTerm,
  trimmedString,
} from './common.validators.js';

export const dueDateRuleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('day_of_following_month'),
    day: z.coerce.number().int().min(1).max(31),
    monthsAfter: z.coerce.number().int().min(0).max(12).default(1),
  }),
  z.object({
    kind: z.literal('days_after_period_end'),
    days: z.coerce.number().int().min(0).max(365),
  }),
  z.object({
    kind: z.literal('fixed_day_month_after_period'),
    day: z.coerce.number().int().min(1).max(31),
    month: z.coerce.number().int().min(1).max(12),
    yearsAfter: z.coerce.number().int().min(0).max(1).default(0),
  }),
]);

export const checklistEntrySchema = z.object({
  title: trimmedString(2, 200),
  documentType: z.enum(DOCUMENT_TYPES),
  description: nullableText(2000),
});

const base = {
  name: trimmedString(2, 120),
  category: z.enum(COMPLIANCE_CATEGORIES),
  isRecurring: z.boolean().default(true),
  defaultFrequency: z.enum(FREQUENCIES),
  dueDateRule: z.union([dueDateRuleSchema, z.null()]).optional(),
  defaultDocumentChecklist: z.array(checklistEntrySchema).max(20).optional(),
  reminderOffsetsDays: z.array(z.coerce.number().int().min(0).max(90)).max(6).optional(),
  active: z.boolean().optional(),
};

export const createComplianceTypeBody = z
  .object({
    ...base,
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,40}$/, 'A code is uppercase letters, digits, hyphens or underscores.'),
  })
  .superRefine((value, ctx) => {
    if (value.isRecurring && (value.dueDateRule === null || value.dueDateRule === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['dueDateRule'],
        message: 'A recurring filing needs a due-date rule so FirmDesk can generate periods.',
      });
    }
  });

export const updateComplianceTypeBody = z.object({
  ...base,
  name: trimmedString(2, 120).optional(),
  category: z.enum(COMPLIANCE_CATEGORIES).optional(),
  isRecurring: z.boolean().optional(),
  defaultFrequency: z.enum(FREQUENCIES).optional(),
});

export const complianceTypeListQuery = z.object({
  category: z.enum(COMPLIANCE_CATEGORIES).optional(),
  active: optionalBooleanQuery,
  isRecurring: optionalBooleanQuery,
  q: searchTerm,
});

export type CreateComplianceTypeBody = z.infer<typeof createComplianceTypeBody>;
export type UpdateComplianceTypeBody = z.infer<typeof updateComplianceTypeBody>;
