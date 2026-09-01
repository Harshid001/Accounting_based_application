import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

import { CONTEXT_REF_KINDS, ROLES } from '../lib/enums.js';
import type { ContextRefKind, Role } from '../lib/enums.js';

export interface ContextRefAttributes {
  kind: ContextRefKind;
  id: Types.ObjectId;
}

export interface MessageAttributes {
  client: Types.ObjectId;
  author: Types.ObjectId;
  authorRole: Role;
  body: string;
  attachments: Types.ObjectId[];
  contextRef?: ContextRefAttributes | null;
  readBy: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export type MessageDocument = HydratedDocument<MessageAttributes>;

const contextRefSchema = new Schema<ContextRefAttributes>(
  {
    kind: { type: String, enum: CONTEXT_REF_KINDS, required: true },
    id: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false },
);

const messageSchema = new Schema<MessageAttributes>(
  {
    client: { type: Schema.Types.ObjectId, ref: 'client', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    authorRole: { type: String, enum: ROLES, required: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 8000 },
    attachments: { type: [Schema.Types.ObjectId], ref: 'document', default: [] },
    contextRef: { type: contextRefSchema, default: null },
    readBy: { type: [Schema.Types.ObjectId], ref: 'user', default: [] },
  },
  { timestamps: true, collection: 'message' },
);

messageSchema.index({ client: 1, createdAt: -1 });
messageSchema.index({ client: 1, readBy: 1 });

export const Message: Model<MessageAttributes> = model<MessageAttributes>(
  'message',
  messageSchema,
);
