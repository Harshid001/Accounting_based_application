import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

import { CLIENT_STATUSES, CLIENT_TYPES, ENTITY_TYPES } from '../lib/enums.js';
import type { ClientStatus, ClientType, EntityType } from '../lib/enums.js';
import {
  CIN_PATTERN,
  GSTIN_PATTERN,
  PAN_PATTERN,
  PHONE_PATTERN,
  PINCODE_PATTERN,
  TAN_PATTERN,
} from '../lib/identifiers.js';

export interface ContactAttributes {
  name: string;
  role?: string | null;
  email: string;
  phone?: string | null;
}

export interface AddressAttributes {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}

export interface EncryptedAadhaar {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
}

export interface ClientAttributes {
  clientType: ClientType;
  displayName: string;
  legalName?: string | null;
  status: ClientStatus;
  archived: boolean;
  archivedAt?: Date | null;
  archivedBy?: Types.ObjectId | null;
  pan?: string | null;
  aadhaarEncrypted?: EncryptedAadhaar | null;
  gstin?: string | null;
  tan?: string | null;
  cin?: string | null;
  entityType?: EntityType | null;
  incorporationDate?: Date | null;
  dateOfBirth?: Date | null;
  primaryContact: ContactAttributes;
  additionalContacts: ContactAttributes[];
  address?: AddressAttributes | null;
  assignedStaff: Types.ObjectId[];
  notes?: string | null;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ClientDocument = HydratedDocument<ClientAttributes>;

const contactSchema = new Schema<ContactAttributes>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    role: { type: String, default: null, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phone: {
      type: String,
      default: null,
      trim: true,
      validate: {
        validator: (value: string | null) => value === null || PHONE_PATTERN.test(value),
        message: 'Enter a 10-digit Indian mobile number or a number in +91 form.',
      },
    },
  },
  { _id: false },
);

const addressSchema = new Schema<AddressAttributes>(
  {
    line1: { type: String, default: null, trim: true, maxlength: 200 },
    line2: { type: String, default: null, trim: true, maxlength: 200 },
    city: { type: String, default: null, trim: true, maxlength: 80 },
    state: { type: String, default: null, trim: true, maxlength: 80 },
    pincode: {
      type: String,
      default: null,
      trim: true,
      validate: {
        validator: (value: string | null) => value === null || PINCODE_PATTERN.test(value),
        message: 'A pincode is six digits and does not start with zero.',
      },
    },
  },
  { _id: false },
);

const encryptedAadhaarSchema = new Schema<EncryptedAadhaar>(
  {
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    keyVersion: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const patternValidator = (pattern: RegExp, message: string) => ({
  validator: (value: string | null) => value === null || pattern.test(value),
  message,
});

const clientSchema = new Schema<ClientAttributes>(
  {
    clientType: { type: String, enum: CLIENT_TYPES, required: true, immutable: true },
    displayName: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
    legalName: { type: String, default: null, trim: true, maxlength: 200 },
    status: { type: String, enum: CLIENT_STATUSES, default: 'onboarding', required: true },
    archived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
    pan: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
      validate: patternValidator(PAN_PATTERN, 'A PAN looks like ABCDE1234F.'),
    },
    aadhaarEncrypted: { type: encryptedAadhaarSchema, default: null, select: false },
    gstin: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
      validate: patternValidator(GSTIN_PATTERN, 'A GSTIN is 15 characters, such as 27ABCDE1234F1Z5.'),
    },
    tan: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
      validate: patternValidator(TAN_PATTERN, 'A TAN looks like MUMA12345B.'),
    },
    cin: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
      validate: patternValidator(CIN_PATTERN, 'A CIN is exactly 21 characters.'),
    },
    entityType: { type: String, enum: [...ENTITY_TYPES, null], default: null },
    incorporationDate: { type: Date, default: null },
    dateOfBirth: { type: Date, default: null },
    primaryContact: { type: contactSchema, required: true },
    additionalContacts: {
      type: [contactSchema],
      default: [],
      validate: {
        validator: (value: ContactAttributes[]) => value.length <= 10,
        message: 'A client record holds at most ten additional contacts.',
      },
    },
    address: { type: addressSchema, default: null },
    assignedStaff: { type: [Schema.Types.ObjectId], ref: 'user', default: [] },
    notes: { type: String, default: null, maxlength: 4000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
  },
  { timestamps: true, collection: 'client', minimize: false },
);

clientSchema.pre('validate', function preValidate() {
  const businessOnly: Array<keyof ClientAttributes> = [
    'gstin',
    'tan',
    'cin',
    'entityType',
    'incorporationDate',
  ];
  const individualOnly: Array<keyof ClientAttributes> = ['aadhaarEncrypted', 'dateOfBirth'];
  const offending: string[] = [];

  if (this.clientType === 'individual') {
    for (const field of businessOnly) {
      if (this.get(field) !== null && this.get(field) !== undefined) offending.push(field);
    }
  } else {
    for (const field of individualOnly) {
      if (this.get(field) !== null && this.get(field) !== undefined) offending.push(field);
    }
  }

  if (offending.length > 0) {
    const kind = this.clientType === 'individual' ? 'an individual' : 'a business';
    throw new Error(
      `${offending.join(', ')} cannot be stored on ${kind} client record. Remove ${offending.length === 1 ? 'it' : 'them'} and save again.`,
    );
  }
});

clientSchema.index({ archived: 1, status: 1, displayName: 1 });
clientSchema.index({ assignedStaff: 1, archived: 1 });
clientSchema.index({ pan: 1 }, { unique: true, partialFilterExpression: { pan: { $type: 'string' } } });
clientSchema.index(
  { gstin: 1 },
  { unique: true, partialFilterExpression: { gstin: { $type: 'string' } } },
);
clientSchema.index({ cin: 1 }, { unique: true, partialFilterExpression: { cin: { $type: 'string' } } });
clientSchema.index(
  { displayName: 'text', legalName: 'text', pan: 'text', gstin: 'text' },
  { name: 'client_search', weights: { displayName: 10, legalName: 5, pan: 3, gstin: 3 } },
);

export const Client: Model<ClientAttributes> = model<ClientAttributes>('client', clientSchema);
