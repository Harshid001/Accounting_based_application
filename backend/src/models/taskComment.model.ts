import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

export interface TaskCommentAttributes {
  task: Types.ObjectId;
  author: Types.ObjectId;
  body: string;
  editedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type TaskCommentDocument = HydratedDocument<TaskCommentAttributes>;

const taskCommentSchema = new Schema<TaskCommentAttributes>(
  {
    task: { type: Schema.Types.ObjectId, ref: 'task', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 4000 },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'taskComment' },
);

taskCommentSchema.index({ task: 1, createdAt: 1 });

export const TaskComment: Model<TaskCommentAttributes> = model<TaskCommentAttributes>(
  'taskComment',
  taskCommentSchema,
);
