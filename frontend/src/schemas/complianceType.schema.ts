import { z } from 'zod';

import {
  COMPLIANCE_CATEGORIES,
  DOCUMENT_TYPES,
  DUE_DATE_RULE_KINDS,
  FREQUENCIES,
} from '@/types/enums';
import type { DueDateRule } from '@/types/models';

export const checklistEntrySchema = z.object({
  title: z.string().trim().min(2, 'Name the document you need.').max(200, 'Keep this under 200 characters.'),
  documentType: z.enum(DOCUMENT_TYPES),
  description: z.string().trim().max(2000, 'Keep this under 2000 characters.'),
});
export type ChecklistEntryValues = z.infer<typeof checklistEntrySchema>;

export const complianceTypeSchema = z
  .object({
    name: z.string().trim().min(2, 'Name this filing.').max(120, 'Keep the name under 120 characters.'),
    code: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .refine(
        (value) => /^[A-Z0-9_-]{2,40}$/.test(value),
        'A code is uppercase letters, digits, hyphens or underscores.',
      ),
    category: z.enum(COMPLIANCE_CATEGORIES),
    isRecurring: z.boolean(),
    defaultFrequency: z.enum(FREQUENCIES),
    ruleKind: z.enum(DUE_DATE_RULE_KINDS),
    ruleDay: z.string().trim(),
    ruleMonthsAfter: z.string().trim(),
    ruleDays: z.string().trim(),
    ruleMonth: z.string().trim(),
    ruleYearsAfter: z.string().trim(),
    reminderOffsetsDays: z.string().trim(),
    defaultDocumentChecklist: z.array(checklistEntrySchema).max(20, 'Twenty entries is the limit.'),
    active: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!value.isRecurring) return;
    const numeric = (raw: string, field: string, min: number, max: number): void => {
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `Enter a whole number between ${min} and ${max}.`,
        });
      }
    };
    if (value.ruleKind === 'day_of_following_month') {
      numeric(value.ruleDay, 'ruleDay', 1, 31);
      numeric(value.ruleMonthsAfter, 'ruleMonthsAfter', 0, 12);
    } else if (value.ruleKind === 'days_after_period_end') {
      numeric(value.ruleDays, 'ruleDays', 0, 365);
    } else {
      numeric(value.ruleDay, 'ruleDay', 1, 31);
      numeric(value.ruleMonth, 'ruleMonth', 1, 12);
      numeric(value.ruleYearsAfter, 'ruleYearsAfter', 0, 1);
    }
  });

export type ComplianceTypeFormValues = z.infer<typeof complianceTypeSchema>;

export const emptyComplianceType: ComplianceTypeFormValues = {
  name: '',
  code: '',
  category: 'gst',
  isRecurring: true,
  defaultFrequency: 'monthly',
  ruleKind: 'day_of_following_month',
  ruleDay: '20',
  ruleMonthsAfter: '1',
  ruleDays: '30',
  ruleMonth: '10',
  ruleYearsAfter: '0',
  reminderOffsetsDays: '7, 3, 1',
  defaultDocumentChecklist: [],
  active: true,
};

export const buildDueDateRule = (values: ComplianceTypeFormValues): DueDateRule | null => {
  if (!values.isRecurring) return null;
  const int = (raw: string, fallback: number): number => {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  switch (values.ruleKind) {
    case 'day_of_following_month':
      return {
        kind: 'day_of_following_month',
        day: int(values.ruleDay, 20),
        monthsAfter: int(values.ruleMonthsAfter, 1),
      };
    case 'days_after_period_end':
      return { kind: 'days_after_period_end', days: int(values.ruleDays, 30) };
    case 'fixed_day_month_after_period':
      return {
        kind: 'fixed_day_month_after_period',
        day: int(values.ruleDay, 31),
        month: int(values.ruleMonth, 10),
        yearsAfter: int(values.ruleYearsAfter, 0),
      };
  }
};

export const parseOffsets = (raw: string): number[] =>
  raw
    .split(/[,\s]+/)
    .map((part) => Number.parseInt(part, 10))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 90)
    .slice(0, 6);

export const toComplianceTypePayload = (
  values: ComplianceTypeFormValues,
  options: { includeCode: boolean },
): Record<string, unknown> => ({
  name: values.name,
  ...(options.includeCode ? { code: values.code } : {}),
  category: values.category,
  isRecurring: values.isRecurring,
  defaultFrequency: values.defaultFrequency,
  dueDateRule: buildDueDateRule(values),
  reminderOffsetsDays: parseOffsets(values.reminderOffsetsDays),
  defaultDocumentChecklist: values.defaultDocumentChecklist.map((entry) => ({
    title: entry.title,
    documentType: entry.documentType,
    description: entry.description.trim().length === 0 ? null : entry.description.trim(),
  })),
  active: values.active,
});
