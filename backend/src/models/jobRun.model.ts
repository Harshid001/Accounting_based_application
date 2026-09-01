import type { HydratedDocument, Model } from 'mongoose';
import { Schema, model } from 'mongoose';

import { JOB_NAMES, JOB_STATUSES } from '../lib/enums.js';
import type { JobName, JobStatus } from '../lib/enums.js';

export interface JobRunAttributes {
  jobName: JobName;
  status: JobStatus;
  startedAt: Date;
  finishedAt?: Date | null;
  lockedUntil: Date;
  result?: Record<string, number> | null;
  error?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type JobRunDocument = HydratedDocument<JobRunAttributes>;

const jobRunSchema = new Schema<JobRunAttributes>(
  {
    jobName: { type: String, enum: JOB_NAMES, required: true },
    status: { type: String, enum: JOB_STATUSES, default: 'running', required: true },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, default: null },
    lockedUntil: { type: Date, required: true },
    result: { type: Schema.Types.Mixed, default: null },
    error: { type: String, default: null, maxlength: 1000 },
  },
  { timestamps: true, collection: 'jobRun' },
);

jobRunSchema.index({ jobName: 1, lockedUntil: 1 });
jobRunSchema.index({ jobName: 1, startedAt: -1 });

export const JobRun: Model<JobRunAttributes> = model<JobRunAttributes>('jobRun', jobRunSchema);
