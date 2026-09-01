import { z } from 'zod';

import { COMPLIANCE_CATEGORIES, COMPLIANCE_STATUSES, PERIOD_TYPES } from '../lib/enums.js';
import {
  dateOnlyString,
  nullableDateOnly,
  nullableText,
  objectId,
  optionalBooleanQuery,
  optionalDateOnly,
  pageQuery,
  sortParam,
} from './common.validators.js';

export const complianceListQuery = pageQuery.extend({
  client: objectId.optional(),
  complianceType: objectId.optional(),
  category: z.enum(COMPLIANCE_CATEGORIES).optional(),
  status: z.enum(COMPLIANCE_STATUSES).optional(),
  assignedTo: objectId.optional(),
  overdue: optionalBooleanQuery,
  dueFrom: optionalDateOnly,
  dueTo: optionalDateOnly,
  periodStart: optionalDateOnly,
  sort: sortParam,
});

export const complianceExportQuery = complianceListQuery.omit({ page: true, limit: true });

export const createComplianceBody = z.object({
  clientId: objectId,
  complianceTypeId: objectId,
  periodType: z.enum(PERIOD_TYPES),
  periodAnchor: dateOnlyString,
  dueDate: optionalDateOnly,
  assignedStaff: z.union([objectId, z.null()]).optional(),
  notes: nullableText(4000),
});

export const updateComplianceBody = z.object({
  dueDate: optionalDateOnly,
  assignedStaff: z.union([objectId, z.null()]).optional(),
  notes: nullableText(4000),
  acknowledgementRef: nullableText(120),
});

export const complianceStatusBody = z
  .object({
    status: z.enum(COMPLIANCE_STATUSES),
    filedDate: optionalDateOnly,
    notApplicableReason: z.string().trim().min(3).max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.status === 'filed' || value.status === 'acknowledged') && !value.filedDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['filedDate'],
        message: 'Enter the date the return was filed.',
      });
    }
    if (value.status === 'not_applicable' && !value.notApplicableReason) {
      ctx.addIssue({
        code: 'custom',
        path: ['notApplicableReason'],
        message: 'Say why this filing does not apply. A short reason is enough.',
      });
    }
  });

export const generateBody = z
  .object({
    complianceTypeId: objectId,
    periodStart: dateOnlyString,
    periodEnd: dateOnlyString,
    clientIds: z.array(objectId).max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.periodEnd.getTime() < value.periodStart.getTime()) {
      ctx.addIssue({
        code: 'custom',
        path: ['periodEnd'],
        message: 'The end of the range must fall on or after its start.',
      });
    }
  });

export const complianceIdParam = z.object({ id: objectId });

export const portalComplianceQuery = pageQuery.extend({
  status: z.enum(COMPLIANCE_STATUSES).optional(),
  dueFrom: optionalDateOnly,
  dueTo: optionalDateOnly,
});

export const nullableDate = nullableDateOnly;

export type CreateComplianceBody = z.infer<typeof createComplianceBody>;
export type UpdateComplianceBody = z.infer<typeof updateComplianceBody>;
export type ComplianceStatusBody = z.infer<typeof complianceStatusBody>;
export type GenerateBody = z.infer<typeof generateBody>;
