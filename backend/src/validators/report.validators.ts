import { z } from 'zod';

import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_KINDS,
  COMPLIANCE_CATEGORIES,
  COMPLIANCE_STATUSES,
} from '../lib/enums.js';
import { objectId, optionalDateOnly, pageQuery } from './common.validators.js';

export const reportFiltersQuery = z.object({
  dateFrom: optionalDateOnly,
  dateTo: optionalDateOnly,
  client: objectId.optional(),
  complianceType: objectId.optional(),
  category: z.enum(COMPLIANCE_CATEGORIES).optional(),
  status: z.enum(COMPLIANCE_STATUSES).optional(),
});

export const reportNameParam = z.object({
  name: z.enum(['compliance', 'workload', 'roster']),
});

export const auditListQuery = pageQuery.extend({
  actor: objectId.optional(),
  entityKind: z.enum(AUDIT_ENTITY_KINDS).optional(),
  entityId: objectId.optional(),
  client: objectId.optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  dateFrom: optionalDateOnly,
  dateTo: optionalDateOnly,
});

export const searchQuery = z.object({
  q: z.string().trim().min(2, 'Type at least two characters to search.').max(200),
});

export const firmSettingsBody = z.object({
  firmName: z.string().trim().min(2).max(160).optional(),
  address: z
    .union([
      z.object({
        line1: z.union([z.string().trim().max(200), z.null()]).optional(),
        line2: z.union([z.string().trim().max(200), z.null()]).optional(),
        city: z.union([z.string().trim().max(80), z.null()]).optional(),
        state: z.union([z.string().trim().max(80), z.null()]).optional(),
        pincode: z
          .union([z.string().trim().regex(/^[1-9][0-9]{5}$/, 'A pincode is six digits.'), z.null()])
          .optional(),
      }),
      z.null(),
    ])
    .optional(),
  contactEmail: z.union([z.email('Enter a complete email address.'), z.null()]).optional(),
  contactPhone: z.union([z.string().trim().max(20), z.null()]).optional(),
  logoStorageKey: z.union([z.string().trim().max(300), z.null()]).optional(),
  defaultReminderOffsetsDays: z.array(z.coerce.number().int().min(0).max(90)).max(6).optional(),
  complianceHorizonDays: z.coerce.number().int().min(1).max(1095).optional(),
});

export type ReportFiltersQuery = z.infer<typeof reportFiltersQuery>;
export type AuditListQuery = z.infer<typeof auditListQuery>;
