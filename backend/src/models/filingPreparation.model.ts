import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

import { FILING_PREP_STATUSES } from '../lib/enums.js';
import type { FilingPrepStatus } from '../lib/enums.js';

export interface FilingGuideStep {
  title: string;
  detail: string | null;
  portalUrl: string | null;
  done: boolean;
}

export interface FilingPreparationAttributes {
  complianceItem: Types.ObjectId;
  client: Types.ObjectId;
  formCode: string;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  status: FilingPrepStatus;
  summary: Record<string, unknown>;
  computed: Record<string, unknown>;
  portalPayload: Record<string, unknown> | null;
  portalName: string | null;
  guideSteps: FilingGuideStep[];
  missingInputs: string[];
  preparedBy: Types.ObjectId | null;
  lockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type FilingPreparationDocument = HydratedDocument<FilingPreparationAttributes>;

const guideStepSchema = new Schema<FilingGuideStep>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    detail: { type: String, default: null, trim: true, maxlength: 1000 },
    portalUrl: { type: String, default: null, trim: true, maxlength: 300 },
    done: { type: Boolean, default: false },
  },
  { _id: false },
);

const filingPreparationSchema = new Schema<FilingPreparationAttributes>(
  {
    complianceItem: {
      type: Schema.Types.ObjectId,
      ref: 'complianceItem',
      required: true,
      unique: true,
    },
    client: { type: Schema.Types.ObjectId, ref: 'client', required: true },
    formCode: { type: String, required: true, trim: true, maxlength: 20 },
    periodLabel: { type: String, required: true, trim: true, maxlength: 60 },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    status: { type: String, enum: FILING_PREP_STATUSES, default: 'draft', required: true },
    summary: { type: Schema.Types.Mixed, default: {} },
    computed: { type: Schema.Types.Mixed, default: {} },
    portalPayload: { type: Schema.Types.Mixed, default: null },
    portalName: { type: String, default: null, trim: true, maxlength: 120 },
    guideSteps: { type: [guideStepSchema], default: [] },
    missingInputs: { type: [String], default: [] },
    preparedBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
    lockedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'filingPreparation' },
);

filingPreparationSchema.index({ client: 1, status: 1, periodEnd: -1 });
filingPreparationSchema.index({ preparedBy: 1, status: 1 });

export const FilingPreparation: Model<FilingPreparationAttributes> = model<
  FilingPreparationAttributes
>('filingPreparation', filingPreparationSchema);
