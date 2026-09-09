import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

import { DESKTOP_COMMAND_STATUSES, DESKTOP_COMMAND_TYPES } from '../lib/enums.js';
import type { DesktopCommandStatus, DesktopCommandType } from '../lib/enums.js';

/**
 * One instruction for a desktop app, drained via the authenticated poll.
 * The full XML payload is built server-side so the desktop bridge stays a
 * dumb relayer: it POSTs the envelope to localhost:9000 and reports back.
 */
export interface DesktopCommandAttributes {
  /** Owning user — commands are per-accountant, not global. */
  user: Types.ObjectId;
  type: DesktopCommandType;
  status: DesktopCommandStatus;
  client?: Types.ObjectId | null;
  /** FirmDesk voucher ids this tally_post covers (idempotency key). */
  voucherIds?: Types.ObjectId[];
  payload: {
    /** Ready-to-send XML envelope for tally_post / tally_import / tally_health. */
    requestXml: string;
    companyName: string;
  };
  result?: {
    ok: boolean;
    /** Parsed outcome detail from the desktop bridge. */
    detail: Record<string, unknown>;
    error?: string | null;
    reportedAt: Date;
    workstation: Types.ObjectId;
  } | null;
  dispatchedAt?: Date | null;
  dispatchedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type DesktopCommandDocument = HydratedDocument<DesktopCommandAttributes>;

const desktopCommandSchema = new Schema<DesktopCommandAttributes>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'user', required: true, immutable: true },
    type: { type: String, enum: DESKTOP_COMMAND_TYPES, required: true, immutable: true },
    status: { type: String, enum: DESKTOP_COMMAND_STATUSES, default: 'queued', required: true },
    client: { type: Schema.Types.ObjectId, ref: 'client', default: null, immutable: true },
    voucherIds: { type: [Schema.Types.ObjectId], default: [] },
    payload: {
      type: new Schema(
        {
          requestXml: { type: String, required: true },
          companyName: { type: String, required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    result: {
      type: new Schema(
        {
          ok: { type: Boolean, required: true },
          detail: { type: Schema.Types.Mixed, required: true, default: {} },
          error: { type: String, default: null, maxlength: 2000 },
          reportedAt: { type: Date, required: true },
          workstation: { type: Schema.Types.ObjectId, ref: 'workstation', required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    dispatchedAt: { type: Date, default: null },
    dispatchedCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, collection: 'desktopCommand' },
);

desktopCommandSchema.index({ user: 1, status: 1, createdAt: -1 });
desktopCommandSchema.index(
  { user: 1, 'payload.companyName': 1, createdAt: -1 },
  { name: 'desktop_command_user_company' },
);

export const DesktopCommand: Model<DesktopCommandAttributes> = model<DesktopCommandAttributes>(
  'desktopCommand',
  desktopCommandSchema,
);
