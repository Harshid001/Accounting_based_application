import { z } from 'zod';

import { DOCUMENT_TYPES } from '@/types/enums';

export const documentUploadSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Give this document a title so it can be found later.')
      .max(200, 'Keep the title under 200 characters.'),
    documentType: z.enum(DOCUMENT_TYPES),
    customTypeLabel: z.string().trim().max(80, 'Keep this under 80 characters.'),
  })
  .superRefine((value, ctx) => {
    if (value.documentType === 'other' && value.customTypeLabel.trim().length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['customTypeLabel'],
        message: 'Name the document type when you choose Other.',
      });
    }
  });

export type DocumentUploadValues = z.infer<typeof documentUploadSchema>;

export const emptyDocumentUpload: DocumentUploadValues = {
  title: '',
  documentType: 'other',
  customTypeLabel: '',
};

export const documentEditSchema = documentUploadSchema;
export type DocumentEditValues = DocumentUploadValues;

export const titleFromFilename = (filename: string): string => {
  const dot = filename.lastIndexOf('.');
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  return stem.replace(/[_-]+/g, ' ').trim().slice(0, 200);
};
