import { z } from 'zod';

import { CONTEXT_REF_KINDS } from '../lib/enums.js';
import { objectId, optionalBooleanQuery, pageQuery, trimmedString } from './common.validators.js';

export const postMessageBody = z.object({
  body: trimmedString(1, 8000),
  attachmentIds: z.array(objectId).max(10).optional(),
  contextRef: z
    .union([z.object({ kind: z.enum(CONTEXT_REF_KINDS), id: objectId }), z.null()])
    .optional(),
});

export const messageListQuery = pageQuery;

export const notificationListQuery = pageQuery.extend({
  unread: optionalBooleanQuery,
});

export type PostMessageBody = z.infer<typeof postMessageBody>;
