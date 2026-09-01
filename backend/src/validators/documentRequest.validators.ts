import { z } from 'zod';

import { DOCUMENT_REQUEST_STATUSES, DOCUMENT_TYPES } from '../lib/enums.js';
import {
  nullableDateOnly,
  nullableText,
  objectId,
  optionalBooleanQuery,
  optionalDateOnly,
  pageQuery,
  trimmedString,
} from './common.validators.js';

const singleRequest = z.object({
  title: trimmedString(3, 200),
  description: nullableText(2000),
  documentType: z.enum(DOCUMENT_TYPES),
  dueDate: nullableDateOnly,
  complianceItemId: z.union([objectId, z.null()]).optional(),
});

export const createDocumentRequestBody = z.union([
  singleRequest.extend({ clientId: objectId }),
  z.object({ clientId: objectId, items: z.array(singleRequest).min(1).max(20) }),
]);

export const updateDocumentRequestBody = singleRequest.partial();

export const documentRequestListQuery = pageQuery.extend({
  client: objectId.optional(),
  status: z.enum(DOCUMENT_REQUEST_STATUSES).optional(),
  complianceItem: objectId.optional(),
  overdue: optionalBooleanQuery,
  dueFrom: optionalDateOnly,
  dueTo: optionalDateOnly,
});

export type CreateDocumentRequestBody = z.infer<typeof createDocumentRequestBody>;
export type SingleDocumentRequest = z.infer<typeof singleRequest>;
