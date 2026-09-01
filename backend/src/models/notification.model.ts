import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

import { NOTIFICATION_TYPES } from '../lib/enums.js';
import type { NotificationType } from '../lib/enums.js';

export interface NotificationEntityRef {
  kind: string;
  id: Types.ObjectId;
}

export interface NotificationAttributes {
  recipient: Types.ObjectId;
  type: NotificationType;
  title: string;
  body?: string | null;
  link: string;
  entity?: NotificationEntityRef | null;
  dedupeKey?: string | null;
  read: boolean;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationDocument = HydratedDocument<NotificationAttributes>;

const entitySchema = new Schema<NotificationEntityRef>(
  {
    kind: { type: String, required: true, trim: true, maxlength: 60 },
    id: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false },
);

const notificationSchema = new Schema<NotificationAttributes>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, default: null, trim: true, maxlength: 1000 },
    link: { type: String, required: true, trim: true, maxlength: 300 },
    entity: { type: entitySchema, default: null },
    dedupeKey: { type: String, default: null, trim: true, maxlength: 200 },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'notification' },
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } },
);
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

export const Notification: Model<NotificationAttributes> = model<NotificationAttributes>(
  'notification',
  notificationSchema,
);
