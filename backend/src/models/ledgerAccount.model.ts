import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

import { ACCOUNT_SUB_TYPES, ACCOUNT_TYPES } from '../lib/enums.js';
import type { AccountSubType, AccountType } from '../lib/enums.js';
import { GSTIN_PATTERN, PAN_PATTERN } from '../lib/identifiers.js';

export interface AccountPartyAttributes {
  gstin?: string | null;
  pan?: string | null;
}

export interface OpeningBalanceAttributes {
  /** Integer paise. Always >= 0; the side is carried by isDebit. */
  paise: number;
  asOf: Date;
  isDebit: boolean;
}

export interface AccountAttributes {
  client: Types.ObjectId;
  code: string;
  name: string;
  type: AccountType;
  subType?: AccountSubType | null;
  parent?: Types.ObjectId | null;
  party?: AccountPartyAttributes | null;
  openingBalance: OpeningBalanceAttributes;
  isActive: boolean;
  /** System accounts are engine-owned (duty/rounding) and cannot be deleted or re-typed. */
  isSystem: boolean;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AccountDocument = HydratedDocument<AccountAttributes>;

const isInteger = (value: number): boolean => Number.isInteger(value) && value >= 0;

const partySchema = new Schema<AccountPartyAttributes>(
  {
    gstin: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
      validate: {
        validator: (value: string | null) => value === null || GSTIN_PATTERN.test(value),
        message: 'A GSTIN is 15 characters, such as 27ABCDE1234F1Z5.',
      },
    },
    pan: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
      validate: {
        validator: (value: string | null) => value === null || PAN_PATTERN.test(value),
        message: 'A PAN looks like ABCDE1234F.',
      },
    },
  },
  { _id: false },
);

const openingBalanceSchema = new Schema<OpeningBalanceAttributes>(
  {
    paise: {
      type: Number,
      required: true,
      default: 0,
      validate: {
        validator: isInteger,
        message: 'Opening balance must be whole paise (>= 0).',
      },
    },
    asOf: { type: Date, required: true },
    isDebit: { type: Boolean, required: true, default: true },
  },
  { _id: false },
);

const accountSchema = new Schema<AccountAttributes>(
  {
    client: { type: Schema.Types.ObjectId, ref: 'client', required: true, immutable: true },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 1,
      maxlength: 24,
    },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 160 },
    type: { type: String, enum: ACCOUNT_TYPES, required: true },
    subType: { type: String, enum: [...ACCOUNT_SUB_TYPES, null], default: null },
    parent: { type: Schema.Types.ObjectId, ref: 'ledgerAccount', default: null },
    party: { type: partySchema, default: null },
    openingBalance: { type: openingBalanceSchema, required: true },
    isActive: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false, immutable: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
  },
  { timestamps: true, collection: 'ledgerAccount', minimize: false },
);

accountSchema.index({ client: 1, code: 1 }, { unique: true, name: 'account_code_unique' });
accountSchema.index({ client: 1, type: 1, isActive: 1, name: 1 });
accountSchema.index(
  { client: 1, subType: 1 },
  {
    unique: true,
    name: 'account_system_subtype_unique',
    partialFilterExpression: { isSystem: true },
  },
);

export const Account: Model<AccountAttributes> = model<AccountAttributes>(
  'ledgerAccount',
  accountSchema,
);
