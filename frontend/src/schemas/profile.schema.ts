import { z } from 'zod';

import { PHONE_PATTERN, addressSchema, contactSchema } from '@/schemas/client.schema';

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(120, 'Keep this under 120 characters.'),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || PHONE_PATTERN.test(value),
      'Enter a 10-digit Indian mobile number starting 6 to 9.',
    ),
});
export type ProfileValues = z.infer<typeof profileSchema>;

export const portalProfileSchema = z.object({
  primaryContact: contactSchema,
  additionalContacts: z.array(contactSchema).max(10, 'Ten extra contacts is the limit.'),
  address: addressSchema,
});
export type PortalProfileValues = z.infer<typeof portalProfileSchema>;

const orNull = (value: string): string | null => (value.trim().length === 0 ? null : value.trim());

export const toPortalProfilePayload = (values: PortalProfileValues): Record<string, unknown> => {
  const contact = (entry: PortalProfileValues['primaryContact']) => ({
    name: entry.name,
    role: orNull(entry.role),
    email: entry.email,
    phone: orNull(entry.phone),
  });

  return {
    primaryContact: contact(values.primaryContact),
    additionalContacts: values.additionalContacts.map(contact),
    address: {
      line1: orNull(values.address.line1),
      line2: orNull(values.address.line2),
      city: orNull(values.address.city),
      state: orNull(values.address.state),
      pincode: orNull(values.address.pincode),
    },
  };
};
