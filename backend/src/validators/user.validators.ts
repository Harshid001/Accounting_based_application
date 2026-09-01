import { z } from 'zod';

import { JOB_NAMES, ROLES, USER_STATUSES } from '../lib/enums.js';
import { PHONE_PATTERN } from '../lib/identifiers.js';
import {
  nullableText,
  objectId,
  optionalBooleanQuery,
  pageQuery,
  searchTerm,
  trimmedString,
} from './common.validators.js';

const phone = z
  .union([z.string().trim().regex(PHONE_PATTERN, 'Enter a 10-digit Indian mobile number.'), z.null()])
  .optional();

export const updateMeBody = z.object({
  name: trimmedString(2, 120).optional(),
  phone,
  image: nullableText(2048),
  notificationPreferences: z
    .object({
      emailOnAssignment: z.boolean().optional(),
      emailDeadlineReminders: z.boolean().optional(),
      emailDailyDigest: z.boolean().optional(),
    })
    .optional(),
});

export const userListQuery = pageQuery.extend({
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  q: searchTerm,
  unlinked: optionalBooleanQuery,
});

export const adminUpdateUserBody = z.object({
  name: trimmedString(2, 120).optional(),
  phone,
});

export const roleBody = z.object({ role: z.enum(ROLES) });

export const linkedClientsBody = z.object({ clientIds: z.array(objectId).max(50) });

export const purgeUnlinkedBody = z.object({
  olderThanDays: z.coerce.number().int().min(1).max(3650).default(30),
});

export const jobNameParam = z.object({ name: z.enum(JOB_NAMES) });

export const jobListQuery = pageQuery.extend({
  jobName: z.enum(JOB_NAMES).optional(),
});

export const clientErrorBody = z.object({
  message: z.string().trim().min(1).max(2000),
  stack: z.string().trim().max(6000).optional(),
  path: z.string().trim().max(500),
  userAgent: z.string().trim().max(400).optional(),
});

export type UpdateMeBody = z.infer<typeof updateMeBody>;
