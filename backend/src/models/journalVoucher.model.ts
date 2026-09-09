import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

import {
  MAX_VOUCHER_LINES,
  TALLY_SYNC_STATUSES,
  VOUCHER_SOURCES,
  VOUCHER_STATUSES,
  VOUCHER_TYPES,
} from '../lib/enums.js';
import type {
  TallySyncStatus,
  VoucherSource,
  VoucherStatus,
  VoucherType,
} from '../lib/enums.js';

export interface LineTaxAttributes {
  /** GST rate as a percentage (e.g. 18, 5, 0.25). Null when the line is not a GST supply. */
  gstRatePct?: number | null;
  hsnSac?: string | null;
  /** Integer paise. Defaults to the line amount when omitted. */
  taxablePaise?: number | null;
  /** Two-digit state code of the place of supply. */
  placeOfSupply?: string | null;
  tdsSection?: string | null;
  tdsRatePct?: number | null;
}

export interface VoucherLineAttributes {
  account: Types.ObjectId;
  /** Integer paise. Exactly one of debitPaise/creditPaise is non-zero. */
  debitPaise: number;
  creditPaise: number;
  description?: string | null;
  tax?: LineTaxAttributes | null;
  /** True for engine-materialised duty/rounding lines. Never supplied by callers. */
  isDerived: boolean;
}

export interface DerivedTotalsAttributes {
  outputTaxPaise: number;
  inputTaxPaise: number;
  tdsPayablePaise: number;
  tdsReceivablePaise: number;
  roundingPaise: number;
}

export interface TallySyncAttributes {
  status: TallySyncStatus;
  voucherRef?: string | null;
  syncedAt?: Date | null;
  error?: string | null;
}

export interface JournalVoucherAttributes {
  client: Types.ObjectId;
  /** Assigned at post time: "JV/2026-27/00042". Null while draft. */
  voucherNo?: string | null;
  fyLabel: string;
  sequence?: number | null;
  date: Date;
  type: VoucherType;
  narration?: string | null;
  reference?: string | null;
  status: VoucherStatus;
  source: VoucherSource;
  lines: VoucherLineAttributes[];
  derived: DerivedTotalsAttributes;
  /** Σ debit (== Σ credit) in integer paise, including derived lines. */
  totalPaise: number;
  tallySync?: TallySyncAttributes | null;
  postedBy?: Types.ObjectId | null;
  postedAt?: Date | null;
  /** The voucher this one reverses (set on reversal vouchers). */
  reversalOf?: Types.ObjectId | null;
  /** The reversal voucher that cancelled this one (set on the original once the reversal posts). */
  reversedBy?: Types.ObjectId | null;
  lockedAt?: Date | null;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type JournalVoucherDocument = HydratedDocument<JournalVoucherAttributes>;

const wholePaise = {
  validator: (value: number) => Number.isInteger(value) && value >= 0,
  message: 'Amounts are whole paise and cannot be negative.',
};

const lineTaxSchema = new Schema<LineTaxAttributes>(
  {
    gstRatePct: { type: Number, default: null, min: 0, max: 100 },
    hsnSac: { type: String, default: null, trim: true, maxlength: 8 },
    taxablePaise: { type: Number, default: null },
    placeOfSupply: { type: String, default: null, trim: true, maxlength: 2 },
    tdsSection: { type: String, default: null, trim: true, maxlength: 12 },
    tdsRatePct: { type: Number, default: null, min: 0, max: 100 },
  },
  { _id: false },
);

const voucherLineSchema = new Schema<VoucherLineAttributes>(
  {
    account: { type: Schema.Types.ObjectId, ref: 'ledgerAccount', required: true },
    debitPaise: { type: Number, required: true, default: 0, validate: wholePaise },
    creditPaise: { type: Number, required: true, default: 0, validate: wholePaise },
    description: { type: String, default: null, trim: true, maxlength: 500 },
    tax: { type: lineTaxSchema, default: null },
    isDerived: { type: Boolean, default: false },
  },
  { _id: false },
);

const derivedTotalsSchema = new Schema<DerivedTotalsAttributes>(
  {
    outputTaxPaise: { type: Number, default: 0, validate: wholePaise },
    inputTaxPaise: { type: Number, default: 0, validate: wholePaise },
    tdsPayablePaise: { type: Number, default: 0, validate: wholePaise },
    tdsReceivablePaise: { type: Number, default: 0, validate: wholePaise },
    roundingPaise: { type: Number, default: 0, validate: wholePaise },
  },
  { _id: false },
);

const tallySyncSchema = new Schema<TallySyncAttributes>(
  {
    status: { type: String, enum: TALLY_SYNC_STATUSES, required: true },
    voucherRef: { type: String, default: null, trim: true, maxlength: 120 },
    syncedAt: { type: Date, default: null },
    error: { type: String, default: null, maxlength: 1000 },
  },
  { _id: false },
);

const journalVoucherSchema = new Schema<JournalVoucherAttributes>(
  {
    client: { type: Schema.Types.ObjectId, ref: 'client', required: true, immutable: true },
    voucherNo: { type: String, default: null, trim: true, maxlength: 40 },
    fyLabel: { type: String, required: true, trim: true, maxlength: 12 },
    sequence: { type: Number, default: null, min: 1 },
    date: { type: Date, required: true },
    type: { type: String, enum: VOUCHER_TYPES, required: true },
    narration: { type: String, default: null, trim: true, maxlength: 2000 },
    reference: { type: String, default: null, trim: true, maxlength: 120 },
    status: { type: String, enum: VOUCHER_STATUSES, default: 'draft', required: true },
    source: { type: String, enum: VOUCHER_SOURCES, default: 'manual', required: true },
    lines: {
      type: [voucherLineSchema],
      required: true,
      validate: {
        validator: (value: VoucherLineAttributes[]) =>
          value.length >= 2 && value.length <= MAX_VOUCHER_LINES,
        message: `A voucher holds between 2 and ${MAX_VOUCHER_LINES} lines.`,
      },
    },
    derived: { type: derivedTotalsSchema, required: true, default: () => ({}) },
    totalPaise: { type: Number, required: true, default: 0, validate: wholePaise },
    tallySync: { type: tallySyncSchema, default: null },
    postedBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
    postedAt: { type: Date, default: null },
    reversalOf: { type: Schema.Types.ObjectId, ref: 'journalVoucher', default: null },
    reversedBy: { type: Schema.Types.ObjectId, ref: 'journalVoucher', default: null },
    lockedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
  },
  { timestamps: true, collection: 'journalVoucher', minimize: false },
);

journalVoucherSchema.pre('validate', function preValidate() {
  let debit = 0;
  let credit = 0;
  for (const line of this.lines) {
    if (line.debitPaise > 0 === line.creditPaise > 0) {
      throw new Error(
        'Each voucher line must carry exactly one of a debit or a credit amount.',
      );
    }
    debit += line.debitPaise;
    credit += line.creditPaise;
  }
  if (debit !== credit) {
    throw new Error('Debits and credits do not balance.');
  }
  if (this.totalPaise !== debit) {
    throw new Error('Voucher total does not match its lines.');
  }
  if (this.status !== 'draft' && (this.voucherNo === null || this.voucherNo === undefined)) {
    throw new Error('A posted voucher must carry a voucher number.');
  }
});

journalVoucherSchema.index({ client: 1, date: -1, _id: -1 });
journalVoucherSchema.index({ client: 1, status: 1, date: -1 });
journalVoucherSchema.index({ client: 1, 'lines.account': 1, date: 1 });
journalVoucherSchema.index(
  { client: 1, voucherNo: 1 },
  {
    unique: true,
    name: 'voucher_no_unique',
    partialFilterExpression: { voucherNo: { $type: 'string' } },
  },
);
journalVoucherSchema.index(
  { client: 1, fyLabel: 1, sequence: 1 },
  {
    unique: true,
    name: 'voucher_sequence_unique',
    partialFilterExpression: { sequence: { $type: 'number' } },
  },
);

export const JournalVoucher: Model<JournalVoucherAttributes> = model<JournalVoucherAttributes>(
  'journalVoucher',
  journalVoucherSchema,
);
