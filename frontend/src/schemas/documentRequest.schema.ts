import { z } from 'zod';

import { DOCUMENT_TYPES } from '@/types/enums';

export const documentRequestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Say what you need from the client.')
    .max(200, 'Keep the title under 200 characters.'),
  description: z.string().trim().max(2000, 'Keep this under 2000 characters.'),
  documentType: z.enum(DOCUMENT_TYPES),
  dueDate: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || /^\d{4}-\d{2}-\d{2}$/.test(value),
      'Enter a date like 29 Jul 2026.',
    ),
  complianceItemId: z.string().trim(),
});

export type DocumentRequestValues = z.infer<typeof documentRequestSchema>;

export const emptyDocumentRequest: DocumentRequestValues = {
  title: '',
  description: '',
  documentType: 'other',
  dueDate: '',
  complianceItemId: '',
};

export const toRequestPayload = (values: DocumentRequestValues) => ({
  title: values.title,
  description: values.description.trim().length === 0 ? null : values.description.trim(),
  documentType: values.documentType,
  dueDate: values.dueDate.length === 0 ? null : values.dueDate,
  complianceItemId: values.complianceItemId.length === 0 ? null : values.complianceItemId,
});
