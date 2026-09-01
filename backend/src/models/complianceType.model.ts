import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

import {
  COMPLIANCE_CATEGORIES,
  DOCUMENT_TYPES,
  DUE_DATE_RULE_KINDS,
  FREQUENCIES,
} from '../lib/enums.js';
import type { ComplianceCategory, DocumentType, Frequency } from '../lib/enums.js';
import type { DueDateRule } from '../lib/dueDate.js';
import { dueDateRuleIsValid } from '../lib/dueDate.js';

export interface ChecklistEntry {
  title: string;
  documentType: DocumentType;
  description?: string | null;
}

export interface ComplianceTypeAttributes {
  name: string;
  code: string;
  category: ComplianceCategory;
  isRecurring: boolean;
  defaultFrequency: Frequency;
  dueDateRule?: DueDateRule | null;
  defaultDocumentChecklist: ChecklistEntry[];
  reminderOffsetsDays: number[];
  isSeeded: boolean;
  active: boolean;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ComplianceTypeDocument = HydratedDocument<ComplianceTypeAttributes>;

const checklistSchema = new Schema<ChecklistEntry>(
  {
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    documentType: { type: String, enum: DOCUMENT_TYPES, required: true },
    description: { type: String, default: null, trim: true, maxlength: 2000 },
  },
  { _id: false },
);

const dueDateRuleSchema = new Schema(
  {
    kind: { type: String, enum: DUE_DATE_RULE_KINDS, required: true },
    day: { type: Number, min: 1, max: 31 },
    monthsAfter: { type: Number, min: 0, max: 12 },
    days: { type: Number, min: 0, max: 365 },
    month: { type: Number, min: 1, max: 12 },
    yearsAfter: { type: Number, min: 0, max: 1 },
  },
  { _id: false },
);

const complianceTypeSchema = new Schema<ComplianceTypeAttributes>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      immutable: true,
      match: [/^[A-Z0-9_-]{2,40}$/, 'A code is uppercase letters, digits, hyphens or underscores.'],
    },
    category: { type: String, enum: COMPLIANCE_CATEGORIES, required: true },
    isRecurring: { type: Boolean, default: true },
    defaultFrequency: { type: String, enum: FREQUENCIES, required: true },
    dueDateRule: { type: dueDateRuleSchema, default: null },
    defaultDocumentChecklist: {
      type: [checklistSchema],
      default: [],
      validate: {
        validator: (value: ChecklistEntry[]) => value.length <= 20,
        message: 'A checklist holds at most twenty entries.',
      },
    },
    reminderOffsetsDays: {
      type: [Number],
      default: [7, 3, 1],
      validate: {
        validator: (value: number[]) =>
          value.length <= 6 && value.every((day) => Number.isInteger(day) && day >= 0 && day <= 90),
        message: 'Reminder offsets are whole numbers of days between 0 and 90, at most six of them.',
      },
    },
    isSeeded: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
  },
  { timestamps: true, collection: 'complianceType', minimize: false },
);

complianceTypeSchema.pre('validate', function preValidate() {
  if (!this.isRecurring) return;
  if (!this.dueDateRule) {
    throw new Error('A recurring compliance type needs a due-date rule.');
  }
  if (!dueDateRuleIsValid(this.dueDateRule)) {
    throw new Error('The due-date rule is not a complete rule of its kind.');
  }
  if (this.defaultFrequency === 'one_time') {
    throw new Error('A recurring compliance type cannot have a one-time frequency.');
  }
});

complianceTypeSchema.index({ code: 1 }, { unique: true });
complianceTypeSchema.index({ name: 1 }, { unique: true });
complianceTypeSchema.index({ active: 1, category: 1, name: 1 });

export const ComplianceType: Model<ComplianceTypeAttributes> = model<ComplianceTypeAttributes>(
  'complianceType',
  complianceTypeSchema,
);
