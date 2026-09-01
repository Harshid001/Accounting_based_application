import { z } from 'zod';

import { ROLES } from '@/types/enums';
import { PHONE_PATTERN } from '@/schemas/client.schema';

export const adminUserSchema = z.object({
  name: z.string().trim().min(2, 'Enter their full name.').max(120, 'Keep this under 120 characters.'),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || PHONE_PATTERN.test(value),
      'Enter a 10-digit Indian mobile number starting 6 to 9.',
    ),
});
export type AdminUserValues = z.infer<typeof adminUserSchema>;

export const roleSchema = z.object({ role: z.enum(ROLES) });
export type RoleValues = z.infer<typeof roleSchema>;

export const purgeSchema = z.object({
  olderThanDays: z
    .string()
    .trim()
    .refine(
      (value) => /^\d{1,4}$/.test(value) && Number.parseInt(value, 10) >= 1,
      'Enter a whole number of days, at least 1.',
    ),
});
export type PurgeValues = z.infer<typeof purgeSchema>;

export const firmSettingsSchema = z.object({
  firmName: z.string().trim().min(2, 'Enter the firm name.').max(160, 'Keep this under 160 characters.'),
  contactEmail: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      'That does not look like a complete email address.',
    ),
  contactPhone: z.string().trim().max(20, 'Keep this under 20 characters.'),
  line1: z.string().trim().max(200, 'Keep this under 200 characters.'),
  line2: z.string().trim().max(200, 'Keep this under 200 characters.'),
  city: z.string().trim().max(80, 'Keep this under 80 characters.'),
  state: z.string().trim().max(80, 'Keep this under 80 characters.'),
  pincode: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || /^[1-9][0-9]{5}$/.test(value),
      'A pincode is six digits and cannot start with zero.',
    ),
  defaultReminderOffsetsDays: z.string().trim(),
  complianceHorizonDays: z
    .string()
    .trim()
    .refine(
      (value) =>
        /^\d{1,4}$/.test(value) &&
        Number.parseInt(value, 10) >= 1 &&
        Number.parseInt(value, 10) <= 1095,
      'Enter a whole number of days between 1 and 1095.',
    ),
});
export type FirmSettingsValues = z.infer<typeof firmSettingsSchema>;

const orNull = (value: string): string | null => (value.trim().length === 0 ? null : value.trim());

export const toFirmSettingsPayload = (values: FirmSettingsValues): Record<string, unknown> => ({
  firmName: values.firmName,
  contactEmail: orNull(values.contactEmail),
  contactPhone: orNull(values.contactPhone),
  address: {
    line1: orNull(values.line1),
    line2: orNull(values.line2),
    city: orNull(values.city),
    state: orNull(values.state),
    pincode: orNull(values.pincode),
  },
  defaultReminderOffsetsDays: values.defaultReminderOffsetsDays
    .split(/[,\s]+/)
    .map((part) => Number.parseInt(part, 10))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 90)
    .slice(0, 6),
  complianceHorizonDays: Number.parseInt(values.complianceHorizonDays, 10),
});
