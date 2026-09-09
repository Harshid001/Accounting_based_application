import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

import {
  AUTOMATION_RUN_MODES,
  AUTOMATION_RUN_STATUSES,
  AUTOMATION_STEP_STATUSES,
  HANDOFF_TYPES,
  PORTAL_KEYS,
} from '../lib/enums.js';
import type {
  AutomationRunMode,
  AutomationRunStatus,
  AutomationStepStatus,
  HandoffType,
  PortalKey,
} from '../lib/enums.js';
import type { ProbedElement, ProbeScreenSnapshot } from '../services/portalAutomation/types.js';

// ---------------------------------------------------------------------------
// Subdocument interfaces
// ---------------------------------------------------------------------------

export interface AutomationStepRecord {
  key: string;
  label: string;
  status: AutomationStepStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  screenshotFileId: string | null;
  error: string | null;
}

export interface AutomationHandoffRecord {
  handoffId: string;
  type: HandoffType;
  prompt: string;
  createdAt: Date;
  resolvedAt: Date | null;
  // NOTE: handoff *values* are NEVER stored — only metadata
}

export interface AutomationRunResult {
  arn: string | null;
  acknowledgementRef: string | null;
  portalRef: string | null;
}

// ---------------------------------------------------------------------------
// Main document
// ---------------------------------------------------------------------------

export interface AutomationRunAttributes {
  client: Types.ObjectId;
  complianceItem: Types.ObjectId;
  filingPreparation: Types.ObjectId;
  portal: PortalKey;
  form: string;
  mode: AutomationRunMode;
  status: AutomationRunStatus;
  recipeVersion: number;
  initiatedBy: Types.ObjectId;
  actorRole: string;
  steps: AutomationStepRecord[];
  handoffs: AutomationHandoffRecord[];
  probeSnapshots: ProbeScreenSnapshot[];
  result: AutomationRunResult;
  error: string | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AutomationRunDocument = HydratedDocument<AutomationRunAttributes>;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const stepSchema = new Schema<AutomationStepRecord>(
  {
    key: { type: String, required: true, trim: true, maxlength: 80 },
    label: { type: String, required: true, trim: true, maxlength: 200 },
    status: {
      type: String,
      enum: AUTOMATION_STEP_STATUSES,
      default: 'pending',
      required: true,
    },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    screenshotFileId: { type: String, default: null, maxlength: 200 },
    error: { type: String, default: null, maxlength: 2000 },
  },
  { _id: false },
);

const handoffSchema = new Schema<AutomationHandoffRecord>(
  {
    handoffId: { type: String, required: true, trim: true, maxlength: 80 },
    type: { type: String, enum: HANDOFF_TYPES, required: true },
    prompt: { type: String, required: true, trim: true, maxlength: 500 },
    createdAt: { type: Date, required: true },
    resolvedAt: { type: Date, default: null },
  },
  { _id: false },
);

const probedElementSchema = new Schema<ProbedElement>(
  {
    tag: { type: String, required: true },
    id: { type: String, default: null },
    name: { type: String, default: null },
    role: { type: String, default: null },
    text: { type: String, default: null },
    placeholder: { type: String, default: null },
    type: { type: String, default: null },
    suggestedSelectors: { type: [String], default: [] },
  },
  { _id: false },
);

const probeScreenSnapshotSchema = new Schema<ProbeScreenSnapshot>(
  {
    stepKey: { type: String, required: true },
    url: { type: String, required: true },
    title: { type: String, required: true },
    timestamp: { type: String, required: true },
    elements: { type: [probedElementSchema], default: [] },
    domHtml: { type: String, default: null },
  },
  { _id: false },
);

const resultSchema = new Schema<AutomationRunResult>(
  {
    arn: { type: String, default: null, maxlength: 60 },
    acknowledgementRef: { type: String, default: null, maxlength: 120 },
    portalRef: { type: String, default: null, maxlength: 120 },
  },
  { _id: false },
);

const automationRunSchema = new Schema<AutomationRunAttributes>(
  {
    client: { type: Schema.Types.ObjectId, ref: 'client', required: true },
    complianceItem: { type: Schema.Types.ObjectId, ref: 'complianceItem', required: true },
    filingPreparation: {
      type: Schema.Types.ObjectId,
      ref: 'filingPreparation',
      required: true,
    },
    portal: { type: String, enum: PORTAL_KEYS, required: true },
    form: { type: String, required: true, trim: true, maxlength: 20 },
    mode: { type: String, enum: AUTOMATION_RUN_MODES, default: 'recipe', required: true },
    status: { type: String, enum: AUTOMATION_RUN_STATUSES, default: 'queued', required: true },
    recipeVersion: { type: Number, required: true, min: 1 },
    initiatedBy: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    actorRole: { type: String, required: true, trim: true, maxlength: 20 },
    steps: { type: [stepSchema], default: [] },
    handoffs: { type: [handoffSchema], default: [] },
    probeSnapshots: { type: [probeScreenSnapshotSchema], default: [] },
    result: {
      type: resultSchema,
      default: () => ({ arn: null, acknowledgementRef: null, portalRef: null }),
    },
    error: { type: String, default: null, maxlength: 4000 },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'automationRun' },
);

automationRunSchema.index({ client: 1, status: 1 });
automationRunSchema.index({ filingPreparation: 1 });
automationRunSchema.index({ initiatedBy: 1, status: 1 });
automationRunSchema.index({ status: 1, createdAt: -1 });

export const AutomationRun: Model<AutomationRunAttributes> = model<AutomationRunAttributes>(
  'automationRun',
  automationRunSchema,
);
