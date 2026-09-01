import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

import { TASK_PRIORITIES, TASK_RECURRENCE_FREQUENCIES, TASK_STATUSES } from '../lib/enums.js';
import type { TaskPriority, TaskRecurrenceFrequency, TaskStatus } from '../lib/enums.js';

export interface ChecklistItemAttributes {
  _id: Types.ObjectId;
  title: string;
  done: boolean;
}

export interface RecurrenceAttributes {
  frequency: TaskRecurrenceFrequency;
  interval: number;
  nextRunAt: Date;
  endDate?: Date | null;
}

export interface TaskAttributes {
  title: string;
  description?: string | null;
  client?: Types.ObjectId | null;
  complianceItem?: Types.ObjectId | null;
  assignee: Types.ObjectId;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date | null;
  completedAt?: Date | null;
  internalOnly: boolean;
  checklist: ChecklistItemAttributes[];
  blockedBy: Types.ObjectId[];
  estimateMinutes?: number | null;
  loggedMinutes: number;
  attachments: Types.ObjectId[];
  recurrence?: RecurrenceAttributes | null;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type TaskDocument = HydratedDocument<TaskAttributes>;

const checklistItemSchema = new Schema<ChecklistItemAttributes>({
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
  done: { type: Boolean, default: false },
});

const recurrenceSchema = new Schema<RecurrenceAttributes>(
  {
    frequency: { type: String, enum: TASK_RECURRENCE_FREQUENCIES, required: true },
    interval: { type: Number, required: true, min: 1, max: 52, default: 1 },
    nextRunAt: { type: Date, required: true },
    endDate: { type: Date, default: null },
  },
  { _id: false },
);

const taskSchema = new Schema<TaskAttributes>(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    description: { type: String, default: null, maxlength: 8000 },
    client: { type: Schema.Types.ObjectId, ref: 'client', default: null },
    complianceItem: { type: Schema.Types.ObjectId, ref: 'complianceItem', default: null },
    assignee: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    status: { type: String, enum: TASK_STATUSES, default: 'not_started', required: true },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'normal', required: true },
    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    internalOnly: { type: Boolean, default: false },
    checklist: {
      type: [checklistItemSchema],
      default: [],
      validate: {
        validator: (value: ChecklistItemAttributes[]) => value.length <= 50,
        message: 'A task checklist holds at most fifty items.',
      },
    },
    blockedBy: { type: [Schema.Types.ObjectId], ref: 'task', default: [] },
    estimateMinutes: { type: Number, default: null, min: 0, max: 100_000 },
    loggedMinutes: { type: Number, default: 0, min: 0, max: 100_000 },
    attachments: { type: [Schema.Types.ObjectId], ref: 'document', default: [] },
    recurrence: { type: recurrenceSchema, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
  },
  { timestamps: true, collection: 'task' },
);

taskSchema.pre('validate', function preValidate() {
  if (this.blockedBy.some((id) => id.equals(this._id))) {
    throw new Error('A task cannot block itself.');
  }
  if (this.status === 'done' && !this.completedAt) {
    this.completedAt = new Date();
  }
  if (this.status !== 'done' && this.completedAt) {
    this.completedAt = null;
  }
  if (!this.client && this.attachments.length > 0) {
    throw new Error('Attach documents only to a task that belongs to a client.');
  }
});

taskSchema.index({ assignee: 1, status: 1, dueDate: 1 });
taskSchema.index({ client: 1, status: 1 });
taskSchema.index({ status: 1, dueDate: 1 });
taskSchema.index({ complianceItem: 1 });
taskSchema.index({ 'recurrence.nextRunAt': 1 }, { sparse: true });

export const Task: Model<TaskAttributes> = model<TaskAttributes>('task', taskSchema);
