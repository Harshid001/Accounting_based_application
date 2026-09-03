import { z } from 'zod';

import { CLIENT_STATUSES, CLIENT_TYPES, ENTITY_TYPES } from '../lib/enums.js';
import {
  AADHAAR_PATTERN,
  CIN_PATTERN,
  GSTIN_PATTERN,
  PAN_PATTERN,
  PHONE_PATTERN,
  PINCODE_PATTERN,
  TAN_PATTERN,
} from '../lib/identifiers.js';
import {
  emailAddress,
  nullableDateOnly,
  nullableText,
  objectId,
  optionalBooleanQuery,
  pageQuery,
  searchTerm,
  sortParam,
  trimmedString,
} from './common.validators.js';

const upper = z.string().trim().toUpperCase();

const identifier = (pattern: RegExp, message: string) =>
  z.union([upper.regex(pattern, message), z.literal(''), z.null()]).optional();

export const contactSchema = z.object({
  name: trimmedString(2, 120),
  role: nullableText(80),
  email: emailAddress,
  phone: z
    .union([z.string().trim().regex(PHONE_PATTERN, 'Enter a 10-digit Indian mobile number.'), z.null()])
    .optional(),
});

export const addressSchema = z.object({
  line1: nullableText(200),
  line2: nullableText(200),
  city: nullableText(80),
  state: nullableText(80),
  pincode: z
    .union([
      z.string().trim().regex(PINCODE_PATTERN, 'A pincode is six digits and cannot start with zero.'),
      z.null(),
    ])
    .optional(),
});

const identifiers = {
  pan: identifier(PAN_PATTERN, 'A PAN looks like ABCDE1234F.'),
  gstin: identifier(GSTIN_PATTERN, 'A GSTIN is 15 characters, such as 27ABCDE1234F1Z5.'),
  tan: identifier(TAN_PATTERN, 'A TAN looks like MUMA12345B.'),
  cin: identifier(CIN_PATTERN, 'A CIN is exactly 21 characters.'),
  aadhaar: z
    .union([
      z
        .string()
        .trim()
        .transform((value) => value.replace(/[\s-]/g, ''))
        .refine((value) => AADHAAR_PATTERN.test(value), 'An Aadhaar number is twelve digits.'),
      z.literal(''),
      z.null(),
    ])
    .optional(),
};

const baseClientBody = {
  displayName: trimmedString(2, 160),
  legalName: nullableText(200),
  status: z.enum(CLIENT_STATUSES).optional(),
  ...identifiers,
  entityType: z.union([z.enum(ENTITY_TYPES), z.null()]).optional(),
  incorporationDate: nullableDateOnly,
  dateOfBirth: nullableDateOnly,
  primaryContact: contactSchema,
  additionalContacts: z.array(contactSchema).max(10).optional(),
  address: z.union([addressSchema, z.null()]).optional(),
  assignedStaff: z.array(objectId).max(50).optional(),
  notes: nullableText(4000),
};

const rejectCrossType = (
  value: {
    clientType?: string;
    gstin?: string | null;
    tan?: string | null;
    cin?: string | null;
    entityType?: string | null;
    incorporationDate?: Date | null;
    aadhaar?: string | null;
    dateOfBirth?: Date | null;
  },
  ctx: z.RefinementCtx,
): void => {
  const isIndividual = value.clientType === 'individual';
  const businessOnly: Array<[string, unknown]> = [
    ['gstin', value.gstin],
    ['tan', value.tan],
    ['cin', value.cin],
    ['entityType', value.entityType],
    ['incorporationDate', value.incorporationDate],
  ];
  const individualOnly: Array<[string, unknown]> = [
    ['aadhaar', value.aadhaar],
    ['dateOfBirth', value.dateOfBirth],
  ];
  const offending = isIndividual ? businessOnly : individualOnly;
  for (const [field, held] of offending) {
    if (held !== undefined && held !== null && held !== '') {
      ctx.addIssue({
        code: 'custom',
        path: [field],
        message: isIndividual
          ? 'This field belongs to a business record only.'
          : 'This field belongs to an individual record only.',
      });
    }
  }
};

export const createClientBody = z
  .object({ clientType: z.enum(CLIENT_TYPES), ...baseClientBody })
  .superRefine(rejectCrossType);

export const updateClientBody = z
  .object({
    clientType: z.enum(CLIENT_TYPES).optional(),
    ...baseClientBody,
    displayName: trimmedString(2, 160).optional(),
    primaryContact: contactSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.clientType !== undefined) rejectCrossType(value, ctx);
  });

export const clientListQuery = pageQuery.extend({
  q: searchTerm,
  status: z.enum(CLIENT_STATUSES).optional(),
  clientType: z.enum(CLIENT_TYPES).optional(),
  assignedTo: objectId.optional(),
  archived: optionalBooleanQuery,
  pinned: optionalBooleanQuery,
  sort: sortParam,
});

export const clientExportQuery = clientListQuery.omit({ page: true, limit: true });

export const assignmentsBody = z.object({ staffIds: z.array(objectId).max(50) });

export const activityQuery = pageQuery.extend({
  action: z.string().trim().max(40).optional(),
});

export const portalProfileBody = z.object({
  primaryContact: contactSchema.optional(),
  additionalContacts: z.array(contactSchema).max(10).optional(),
  address: z.union([addressSchema, z.null()]).optional(),
});

export const portalOnboardingBody = z
  .object({
    clientType: z.enum(CLIENT_TYPES),
    displayName: trimmedString(2, 160),
    legalName: nullableText(200),
    entityType: z.union([z.enum(ENTITY_TYPES), z.null()]).optional(),
    pan: identifiers.pan,
    gstin: identifiers.gstin,
    tan: identifiers.tan,
    cin: identifiers.cin,
    aadhaar: identifiers.aadhaar,
    incorporationDate: nullableDateOnly,
    dateOfBirth: nullableDateOnly,
    primaryContact: contactSchema,
    additionalContacts: z.array(contactSchema).max(10).optional(),
    address: z.union([addressSchema, z.null()]).optional(),
    requestedServices: z.array(z.string().trim().max(80)).max(20).optional(),
    notes: nullableText(4000),
  })
  .superRefine(rejectCrossType);

export type CreateClientBody = z.infer<typeof createClientBody>;
export type UpdateClientBody = z.infer<typeof updateClientBody>;
export type ClientListQueryInput = z.infer<typeof clientListQuery>;
export type PortalOnboardingBody = z.infer<typeof portalOnboardingBody>;

