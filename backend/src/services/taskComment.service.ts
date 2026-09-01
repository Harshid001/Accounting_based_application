import type { Types } from 'mongoose';

import { conflict, forbidden, notFound } from '../lib/errors.js';
import type { PageRequest } from '../lib/pagination.js';
import { sameId } from '../lib/scope.js';
import type { TaskCommentAttributes } from '../models/taskComment.model.js';
import { TaskComment } from '../models/taskComment.model.js';
import { Task } from '../models/task.model.js';
import type { AuthenticatedUser, RequestActor } from '../types/context.js';
import type { Lean } from '../types/lean.js';
import { recordAudit } from './audit.service.js';

const EDIT_WINDOW_MS = 15 * 60 * 1000;

export const listTaskComments = async (
  taskId: Types.ObjectId,
  page: PageRequest,
): Promise<{ items: Lean<TaskCommentAttributes>[]; total: number }> => {
  const [items, total] = await Promise.all([
    TaskComment.find({ task: taskId })
      .sort({ createdAt: 1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate('author', 'name email role image')
      .lean<Lean<TaskCommentAttributes>[]>()
      .exec(),
    TaskComment.countDocuments({ task: taskId }).exec(),
  ]);
  return { items, total };
};

export const createTaskComment = async (
  taskId: Types.ObjectId,
  body: string,
  user: AuthenticatedUser,
  actor: RequestActor,
): Promise<Lean<TaskCommentAttributes>> => {
  const task = await Task.findById(taskId).select('client').lean().exec();
  if (!task) throw notFound('task');

  const created = await TaskComment.create({ task: taskId, author: user.id, body });
  await recordAudit({
    actor,
    action: 'create',
    entityKind: 'taskComment',
    entityId: created._id,
    client: task.client ?? null,
    summary: 'Added an internal comment to a task',
  });

  const record = await TaskComment.findById(created._id)
    .populate('author', 'name email role image')
    .lean<Lean<TaskCommentAttributes> | null>()
    .exec();
  if (!record) throw notFound('comment');
  return record;
};

const assertMayEdit = (
  comment: { author: Types.ObjectId; createdAt: Date },
  user: AuthenticatedUser,
): void => {
  if (user.role === 'admin') return;
  if (!sameId(comment.author, user.id)) {
    throw forbidden('You can only change your own comments.');
  }
  if (Date.now() - comment.createdAt.getTime() > EDIT_WINDOW_MS) {
    throw conflict('Comments can only be edited within fifteen minutes of posting.');
  }
};

export const updateTaskComment = async (
  id: Types.ObjectId,
  body: string,
  user: AuthenticatedUser,
  actor: RequestActor,
): Promise<Lean<TaskCommentAttributes>> => {
  const doc = await TaskComment.findById(id).exec();
  if (!doc) throw notFound('comment');
  assertMayEdit(doc, user);
  doc.body = body;
  doc.editedAt = new Date();
  await doc.save();
  await recordAudit({
    actor,
    action: 'update',
    entityKind: 'taskComment',
    entityId: doc._id,
    summary: 'Edited an internal task comment',
  });
  const record = await TaskComment.findById(id)
    .populate('author', 'name email role image')
    .lean<Lean<TaskCommentAttributes> | null>()
    .exec();
  if (!record) throw notFound('comment');
  return record;
};

export const deleteTaskComment = async (
  id: Types.ObjectId,
  user: AuthenticatedUser,
  actor: RequestActor,
): Promise<void> => {
  const doc = await TaskComment.findById(id).exec();
  if (!doc) throw notFound('comment');
  assertMayEdit(doc, user);
  await doc.deleteOne();
  await recordAudit({
    actor,
    action: 'hard_delete',
    entityKind: 'taskComment',
    entityId: id,
    summary: 'Deleted an internal task comment',
  });
};

export const taskIdOfComment = async (id: Types.ObjectId): Promise<Types.ObjectId> => {
  const record = await TaskComment.findById(id).select('task').lean().exec();
  if (!record) throw notFound('comment');
  return record.task;
};
