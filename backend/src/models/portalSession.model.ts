import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

import { PORTAL_KEYS } from '../lib/enums.js';
import type { PortalKey } from '../lib/enums.js';

// ---------------------------------------------------------------------------
// Portal session — encrypted Playwright storageState per client + portal
// ---------------------------------------------------------------------------

export interface PortalSessionAttributes {
  client: Types.ObjectId;
  portal: PortalKey;
  encryptedState: {
    ciphertext: string;
    iv: string;
    tag: string;
    keyVersion: number;
  };
  expiresAt: Date;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type PortalSessionDocument = HydratedDocument<PortalSessionAttributes>;

const encryptedFieldSchema = new Schema(
  {
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    keyVersion: { type: Number, required: true },
  },
  { _id: false },
);

const portalSessionSchema = new Schema<PortalSessionAttributes>(
  {
    client: { type: Schema.Types.ObjectId, ref: 'client', required: true },
    portal: { type: String, enum: PORTAL_KEYS, required: true },
    encryptedState: { type: encryptedFieldSchema, required: true },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, required: true },
  },
  { timestamps: true, collection: 'portalSession' },
);

portalSessionSchema.index({ client: 1, portal: 1 }, { unique: true });
portalSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PortalSession: Model<PortalSessionAttributes> = model<PortalSessionAttributes>(
  'portalSession',
  portalSessionSchema,
);
