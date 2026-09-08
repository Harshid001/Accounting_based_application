import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, Types as MongooseTypes, model } from 'mongoose';

import { PHONE_PATTERN, PINCODE_PATTERN } from '../lib/identifiers.js';
import type { AddressAttributes } from './client.model.js';

export const FIRM_SETTINGS_ID = new MongooseTypes.ObjectId('000000000000000000000001');

export interface EncryptedSecretAttributes {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
}

export type AiProviderName = 'gemini' | 'openai' | 'custom';

export interface AiConfigAttributes {
  provider: AiProviderName | null;
  enabled: boolean;
  geminiApiKey?: EncryptedSecretAttributes | null;
  geminiModel: string;
  openaiApiKey?: EncryptedSecretAttributes | null;
  openaiModel: string;
  customApiKey?: EncryptedSecretAttributes | null;
  customBaseUrl?: string;
  customModel: string;
  configuredBy?: Types.ObjectId | null;
  configuredAt?: Date | null;
}

export interface FirmSettingsAttributes {
  _id: Types.ObjectId;
  firmName: string;
  address?: AddressAttributes | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  logoStorageKey?: string | null;
  defaultReminderOffsetsDays: number[];
  complianceHorizonDays: number;
  financialYearStartMonth: number;
  aiConfig: AiConfigAttributes;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type FirmSettingsDocument = HydratedDocument<FirmSettingsAttributes>;

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

const encryptedSecretSchema = new Schema<EncryptedSecretAttributes>(
  {
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    keyVersion: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

export const DEFAULT_CUSTOM_AI_BASE_URL = 'https://api.xkiro.com/v1';

export const DEFAULT_AI_MODELS: Record<AiProviderName, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  custom: 'deepseek/deepseek-v4-pro',
};

const aiConfigSchema = new Schema<AiConfigAttributes>(
  {
    provider: { type: String, default: null, enum: [null, 'gemini', 'openai', 'custom'] },
    enabled: { type: Boolean, default: false },
    geminiApiKey: { type: encryptedSecretSchema, default: null },
    geminiModel: {
      type: String,
      default: DEFAULT_AI_MODELS.gemini,
      trim: true,
      maxlength: 100,
    },
    openaiApiKey: { type: encryptedSecretSchema, default: null },
    openaiModel: {
      type: String,
      default: DEFAULT_AI_MODELS.openai,
      trim: true,
      maxlength: 100,
    },
    customApiKey: { type: encryptedSecretSchema, default: null },
    customBaseUrl: {
      type: String,
      default: DEFAULT_CUSTOM_AI_BASE_URL,
      trim: true,
      maxlength: 500,
    },
    customModel: {
      type: String,
      default: DEFAULT_AI_MODELS.custom,
      trim: true,
      maxlength: 100,
    },
    configuredBy: { type: Schema.Types.ObjectId, default: null, ref: 'user' },
    configuredAt: { type: Date, default: null },
  },
  { _id: false },
);

const firmSettingsSchema = new Schema<FirmSettingsAttributes>(
  {
    _id: { type: Schema.Types.ObjectId, default: () => FIRM_SETTINGS_ID },
    firmName: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
    address: { type: addressSchema, default: null },
    contactEmail: { type: String, default: null, trim: true, lowercase: true, maxlength: 200 },
    contactPhone: {
      type: String,
      default: null,
      trim: true,
      validate: {
        validator: (value: string | null) => value === null || PHONE_PATTERN.test(value),
        message: 'Enter a 10-digit Indian mobile number or a number in +91 form.',
      },
    },
    logoStorageKey: { type: String, default: null, trim: true, maxlength: 300 },
    defaultReminderOffsetsDays: {
      type: [Number],
      default: [7, 3, 1],
      validate: {
        validator: (value: number[]) =>
          value.length <= 6 &&
          value.every((day) => Number.isInteger(day) && day >= 0 && day <= 90),
        message:
          'Reminder offsets are whole numbers of days between 0 and 90, at most six of them.',
      },
    },
    complianceHorizonDays: { type: Number, default: 120, min: 1, max: 1095 },
    financialYearStartMonth: { type: Number, default: 4, min: 4, max: 4, immutable: true },
    aiConfig: { type: aiConfigSchema, default: () => ({}) },
  },
  { timestamps: true, collection: 'firmSettings', _id: false, minimize: false },
);

export const FirmSettings: Model<FirmSettingsAttributes> = model<FirmSettingsAttributes>(
  'firmSettings',
  firmSettingsSchema,
);
