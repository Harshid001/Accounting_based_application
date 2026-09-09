import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

/**
 * One registered FirmDesk desktop app instance (an accountant's machine).
 * Presence is derived from lastSeenAt vs WORKSTATION_FRESHNESS_MS; there is no
 * inbound port — the desktop app polls out.
 */
export interface WorkstationAttributes {
  user: Types.ObjectId;
  deviceId: string;
  deviceName: string;
  platform: string | null;
  appVersion: string | null;
  /** Last heartbeat, refreshed by ping. */
  lastSeenAt: Date;
  /** Last Tally probe, relayed by ping. */
  tallyReachable: boolean;
  tallyCompanyName: string | null;
  tallyEducationMode: boolean;
  tallyCheckedAt: Date | null;
  revoked: boolean;
  revokedAt?: Date | null;
  revokedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type WorkstationDocument = HydratedDocument<WorkstationAttributes>;

const workstationSchema = new Schema<WorkstationAttributes>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'user', required: true, immutable: true },
    deviceId: { type: String, required: true, trim: true, minlength: 8, maxlength: 64 },
    deviceName: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    platform: { type: String, default: null, trim: true, maxlength: 80 },
    appVersion: { type: String, default: null, trim: true, maxlength: 40 },
    lastSeenAt: { type: Date, required: true },
    tallyReachable: { type: Boolean, default: false },
    tallyCompanyName: { type: String, default: null, trim: true, maxlength: 200 },
    tallyEducationMode: { type: Boolean, default: false },
    tallyCheckedAt: { type: Date, default: null },
    revoked: { type: Boolean, default: false },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
  },
  { timestamps: true, collection: 'workstation' },
);

workstationSchema.index(
  { user: 1, deviceId: 1 },
  { unique: true, name: 'workstation_user_device_unique' },
);
workstationSchema.index({ lastSeenAt: -1, revoked: 1 });

export const Workstation: Model<WorkstationAttributes> = model<WorkstationAttributes>(
  'workstation',
  workstationSchema,
);
