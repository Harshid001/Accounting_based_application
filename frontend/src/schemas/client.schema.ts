import { z } from 'zod';

import { CLIENT_STATUSES, CLIENT_TYPES, ENTITY_TYPES } from '@/types/enums';

export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/;
export const TAN_PATTERN = /^[A-Z]{4}[0-9]{5}[A-Z]$/;
export const CIN_PATTERN = /^[A-Z0-9]{21}$/;
export const AADHAAR_PATTERN = /^[0-9]{12}$/;
export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
export const PHONE_PATTERN = /^[6-9][0-9]{9}$/;

const optionalIdentifier = (pattern: RegExp, message: string) =>
  z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => value.length === 0 || pattern.test(value), message);

const optionalText = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`);

const dateOnly = z
  .string()
  .trim()
  .refine(
    (value) => value.length === 0 || /^\d{4}-\d{2}-\d{2}$/.test(value),
    'Enter a date like 29 Jul 2026.',
  );

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Enter the contact name.').max(120, 'Keep this under 120 characters.'),
  role: optionalText(80),
  email: z
    .string()
    .trim()
    .min(1, 'Enter an email address for this contact.')
    .email('That does not look like a complete email address.')
    .toLowerCase(),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || PHONE_PATTERN.test(value),
      'Enter a 10-digit Indian mobile number starting 6 to 9.',
    ),
});
export type ContactValues = z.infer<typeof contactSchema>;

export const addressSchema = z.object({
  line1: optionalText(200),
  line2: optionalText(200),
  city: optionalText(80),
  state: optionalText(80),
  pincode: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || PINCODE_PATTERN.test(value),
      'A pincode is six digits and cannot start with zero.',
    ),
});

export const clientSchema = z
  .object({
    clientType: z.enum(CLIENT_TYPES),
    displayName: z
      .string()
      .trim()
      .min(2, 'Enter the name this client is known by.')
      .max(160, 'Keep this under 160 characters.'),
    legalName: optionalText(200),
    status: z.enum(CLIENT_STATUSES),
    pan: optionalIdentifier(PAN_PATTERN, 'A PAN looks like ABCDE1234F.'),
    aadhaar: z
      .string()
      .trim()
      .transform((value) => value.replace(/[\s-]/g, ''))
      .refine(
        (value) => value.length === 0 || AADHAAR_PATTERN.test(value),
        'An Aadhaar number is twelve digits.',
      ),
    dateOfBirth: dateOnly,
    gstin: optionalIdentifier(GSTIN_PATTERN, 'A GSTIN is 15 characters, such as 27ABCDE1234F1Z5.'),
    tan: optionalIdentifier(TAN_PATTERN, 'A TAN looks like MUMA12345B.'),
    cin: optionalIdentifier(CIN_PATTERN, 'A CIN is exactly 21 letters and digits.'),
    entityType: z.union([z.enum(ENTITY_TYPES), z.literal('')]),
    incorporationDate: dateOnly,
    primaryContact: contactSchema,
    additionalContacts: z.array(contactSchema).max(10, 'Ten extra contacts is the limit.'),
    address: addressSchema,
    assignedStaff: z.array(z.string()),
    notes: optionalText(4000),
  })
  .superRefine((value, ctx) => {
    const individualOnly: Array<[string, string]> = [
      ['aadhaar', value.aadhaar],
      ['dateOfBirth', value.dateOfBirth],
    ];
    const businessOnly: Array<[string, string]> = [
      ['gstin', value.gstin],
      ['tan', value.tan],
      ['cin', value.cin],
      ['entityType', value.entityType],
      ['incorporationDate', value.incorporationDate],
    ];
    const offending = value.clientType === 'individual' ? businessOnly : individualOnly;
    for (const [field, held] of offending) {
      if (held.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message:
            value.clientType === 'individual'
              ? 'This field belongs to a business record only.'
              : 'This field belongs to an individual record only.',
        });
      }
    }
  });

export type ClientFormValues = z.infer<typeof clientSchema>;

export const emptyContact: ContactValues = { name: '', role: '', email: '', phone: '' };

export const emptyClient: ClientFormValues = {
  clientType: 'business',
  displayName: '',
  legalName: '',
  status: 'onboarding',
  pan: '',
  aadhaar: '',
  dateOfBirth: '',
  gstin: '',
  tan: '',
  cin: '',
  entityType: '',
  incorporationDate: '',
  primaryContact: emptyContact,
  additionalContacts: [],
  address: { line1: '', line2: '', city: '', state: '', pincode: '' },
  assignedStaff: [],
  notes: '',
};

const blankToNull = (value: string): string | null => (value.trim().length === 0 ? null : value.trim());

export const toClientPayload = (
  values: ClientFormValues,
  options: { includePrivileged: boolean; includeType: boolean },
): Record<string, unknown> => {
  const contact = (entry: ContactValues) => ({
    name: entry.name,
    role: blankToNull(entry.role),
    email: entry.email,
    phone: blankToNull(entry.phone),
  });

  const payload: Record<string, unknown> = {
    displayName: values.displayName,
    legalName: blankToNull(values.legalName),
    primaryContact: contact(values.primaryContact),
    additionalContacts: values.additionalContacts.map(contact),
    address: {
      line1: blankToNull(values.address.line1),
      line2: blankToNull(values.address.line2),
      city: blankToNull(values.address.city),
      state: blankToNull(values.address.state),
      pincode: blankToNull(values.address.pincode),
    },
    notes: blankToNull(values.notes),
  };

  if (options.includeType) payload.clientType = values.clientType;

  if (options.includePrivileged) {
    payload.status = values.status;
    payload.pan = blankToNull(values.pan);
    payload.assignedStaff = values.assignedStaff;
    if (values.clientType === 'individual') {
      payload.aadhaar = blankToNull(values.aadhaar);
      payload.dateOfBirth = blankToNull(values.dateOfBirth);
    } else {
      payload.gstin = blankToNull(values.gstin);
      payload.tan = blankToNull(values.tan);
      payload.cin = blankToNull(values.cin);
      payload.entityType = values.entityType.length === 0 ? null : values.entityType;
      payload.incorporationDate = blankToNull(values.incorporationDate);
    }
  }

  return payload;
};
