import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

/**
 * Atomic per-client, per-financial-year counter for voucher numbers.
 * Numbers are drawn only at post time, so drafts never consume a number and
 * the posted sequence has no gaps.
 */
export interface VoucherSequenceAttributes {
  client: Types.ObjectId;
  fyLabel: string;
  last: number;
}

export type VoucherSequenceDocument = HydratedDocument<VoucherSequenceAttributes>;

const voucherSequenceSchema = new Schema<VoucherSequenceAttributes>(
  {
    client: { type: Schema.Types.ObjectId, ref: 'client', required: true },
    fyLabel: { type: String, required: true, trim: true, maxlength: 12 },
    last: { type: Number, required: true, default: 0, min: 0 },
  },
  { collection: 'voucherSequence' },
);

voucherSequenceSchema.index(
  { client: 1, fyLabel: 1 },
  { unique: true, name: 'voucher_sequence_key' },
);

export const VoucherSequence: Model<VoucherSequenceAttributes> =
  model<VoucherSequenceAttributes>('voucherSequence', voucherSequenceSchema);
