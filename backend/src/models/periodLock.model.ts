import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

import { PERIOD_LOCK_KINDS } from '../lib/enums.js';
import type { PeriodLockKind } from '../lib/enums.js';

export interface PeriodLockAttributes {
  client: Types.ObjectId;
  /** 'YYYY-MM' for monthly locks, 'FY 2026-27' for financial-year locks. */
  period: string;
  kind: PeriodLockKind;
  /** Inclusive date-only bounds the lock covers. */
  periodStart: Date;
  periodEnd: Date;
  lockedAt: Date;
  lockedBy?: Types.ObjectId | null;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PeriodLockDocument = HydratedDocument<PeriodLockAttributes>;

const periodLockSchema = new Schema<PeriodLockAttributes>(
  {
    client: { type: Schema.Types.ObjectId, ref: 'client', required: true, immutable: true },
    period: { type: String, required: true, trim: true, maxlength: 20, immutable: true },
    kind: { type: String, enum: PERIOD_LOCK_KINDS, required: true, immutable: true },
    periodStart: { type: Date, required: true, immutable: true },
    periodEnd: { type: Date, required: true, immutable: true },
    lockedAt: { type: Date, required: true, immutable: true },
    lockedBy: { type: Schema.Types.ObjectId, ref: 'user', default: null, immutable: true },
    note: { type: String, default: null, trim: true, maxlength: 500 },
  },
  { timestamps: true, collection: 'periodLock' },
);

periodLockSchema.index({ client: 1, period: 1 }, { unique: true, name: 'period_lock_unique' });
periodLockSchema.index({ client: 1, periodStart: 1, periodEnd: 1 });

export const PeriodLock: Model<PeriodLockAttributes> = model<PeriodLockAttributes>(
  'periodLock',
  periodLockSchema,
);
