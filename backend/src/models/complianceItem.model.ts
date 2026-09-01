import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

import { COMPLIANCE_STATUSES, GENERATED_BY, PERIOD_TYPES } from '../lib/enums.js';
import type { ComplianceStatus, GeneratedBy, PeriodType } from '../lib/enums.js';

export interface ComplianceItemAttributes {
  client: Types.ObjectId;
  complianceType: Types.ObjectId;
  clientService?: Types.ObjectId | null;
  periodType: PeriodType;
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
  dueDate: Date;
  dueDateOverridden: boolean;
  status: ComplianceStatus;
  filedDate?: Date | null;
  acknowledgementRef?: string | null;
  notApplicableReason?: string | null;
  assignedStaff?: Types.ObjectId | null;
  notes?: string | null;
  generatedBy: GeneratedBy;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ComplianceItemDocument = HydratedDocument<ComplianceItemAttributes>;

const complianceItemSchema = new Schema<ComplianceItemAttributes>(
  {
    client: { type: Schema.Types.ObjectId, ref: 'client', required: true },
    complianceType: { type: Schema.Types.ObjectId, ref: 'complianceType', required: true },
    clientService: { type: Schema.Types.ObjectId, ref: 'clientService', default: null },
    periodType: { type: String, enum: PERIOD_TYPES, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    periodLabel: { type: String, required: true, trim: true, maxlength: 60 },
    dueDate: { type: Date, required: true },
    dueDateOverridden: { type: Boolean, default: false },
    status: { type: String, enum: COMPLIANCE_STATUSES, default: 'pending', required: true },
    filedDate: { type: Date, default: null },
    acknowledgementRef: { type: String, default: null, trim: true, maxlength: 120 },
    notApplicableReason: { type: String, default: null, trim: true, maxlength: 500 },
    assignedStaff: { type: Schema.Types.ObjectId, ref: 'user', default: null },
    notes: { type: String, default: null, maxlength: 4000 },
    generatedBy: { type: String, enum: GENERATED_BY, default: 'manual', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
  },
  { timestamps: true, collection: 'complianceItem' },
);

complianceItemSchema.pre('validate', function preValidate() {
  if (this.periodEnd.getTime() < this.periodStart.getTime()) {
    throw new Error('A period cannot end before it starts.');
  }
  if ((this.status === 'filed' || this.status === 'acknowledged') && !this.filedDate) {
    throw new Error('Record the date this was filed before marking it filed.');
  }
  if (this.status === 'not_applicable' && !this.notApplicableReason) {
    throw new Error('Say why this filing does not apply before marking it not applicable.');
  }
});

complianceItemSchema.index(
  { client: 1, complianceType: 1, periodStart: 1 },
  { unique: true, name: 'compliance_period_unique' },
);
complianceItemSchema.index({ status: 1, dueDate: 1 });
complianceItemSchema.index({ assignedStaff: 1, status: 1, dueDate: 1 });
complianceItemSchema.index({ client: 1, dueDate: -1 });
complianceItemSchema.index({ complianceType: 1, periodStart: 1, status: 1 });
complianceItemSchema.index({ clientService: 1 });

export const ComplianceItem: Model<ComplianceItemAttributes> = model<ComplianceItemAttributes>(
  'complianceItem',
  complianceItemSchema,
);
