import { z } from 'zod';

import { ALLOWED_MIME_TYPES, DOCUMENT_TYPES, MAX_UPLOAD_BYTES } from '../lib/enums.js';
import {
  nullableText,
  objectId,
  optionalBooleanQuery,
  pageQuery,
  searchTerm,
  sortParam,
  trimmedString,
} from './common.validators.js';

const filename = z
  .string()
  .trim()
  .min(1)
  .max(260)
  .refine((value) => !value.includes('/') && !value.includes('\\') && !value.includes('\0'), {
    message: 'A file name cannot contain a path.',
  });

export const presignBody = z.object({
  clientId: objectId,
  filename,
  mimeType: z.enum(ALLOWED_MIME_TYPES as unknown as [string, ...string[]]),
  sizeBytes: z.coerce.number().int().min(1).max(MAX_UPLOAD_BYTES),
});

export const finaliseBody = z
  .object({
    clientId: objectId,
    storageKey: z.string().trim().min(8).max(300),
    filename,
    mimeType: z.enum(ALLOWED_MIME_TYPES as unknown as [string, ...string[]]),
    title: trimmedString(1, 200),
    documentType: z.enum(DOCUMENT_TYPES),
    customTypeLabel: nullableText(80),
    complianceItemId: z.union([objectId, z.null()]).optional(),
    documentRequestId: z.union([objectId, z.null()]).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.documentType === 'other' && !value.customTypeLabel) {
      ctx.addIssue({
        code: 'custom',
        path: ['customTypeLabel'],
        message: 'Name the document type when you choose Other.',
      });
    }
  });

export const versionBody = z.object({
  storageKey: z.string().trim().min(8).max(300),
  filename,
  mimeType: z.enum(ALLOWED_MIME_TYPES as unknown as [string, ...string[]]),
});

export const documentListQuery = pageQuery.extend({
  client: objectId.optional(),
  documentType: z.enum(DOCUMENT_TYPES).optional(),
  complianceItem: objectId.optional(),
  archived: optionalBooleanQuery,
  q: searchTerm,
  sort: sortParam,
});

export const documentPatchBody = z.object({
  title: trimmedString(1, 200).optional(),
  documentType: z.enum(DOCUMENT_TYPES).optional(),
  customTypeLabel: nullableText(80),
  complianceItemId: z.union([objectId, z.null()]).optional(),
});

export const downloadQuery = z.object({
  version: z.coerce.number().int().min(1).max(20).optional(),
});

export const hardDeleteBody = z.object({ confirm: z.string().min(1).max(200) });

export type PresignBody = z.infer<typeof presignBody>;
export type FinaliseBody = z.infer<typeof finaliseBody>;
