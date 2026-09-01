import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

export interface SessionAttributes {
  token: string;
  userId: Types.ObjectId;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SessionDocument = HydratedDocument<SessionAttributes>;

const sessionSchema = new Schema<SessionAttributes>(
  {
    token: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    expiresAt: { type: Date, required: true },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true, collection: 'session', strict: false },
);

sessionSchema.index({ userId: 1, createdAt: -1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session: Model<SessionAttributes> = model<SessionAttributes>(
  'session',
  sessionSchema,
);
