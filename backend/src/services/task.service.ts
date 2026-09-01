import type { QueryFilter, Types } from 'mongoose';

import { todayIST } from '../lib/date.js';
import type { TaskPriority, TaskStatus } from '../lib/enums.js';
import { conflict, forbidden, notFound, validationFailed } from '../lib/errors.js';
import { escapeRegex } from '../lib/identifiers.js';
import type { PageRequest } from '../lib/pagination.js';
import { parseSort, withTiebreak } from '../lib/pagination.js';
import { containsId, sameId } from '../lib/scope.js';
import { Client } from '../models/client.model.js';
import { DocumentModel } from '../models/document.model.js';
import type { TaskAttributes } from '../models/task.model.js';
import { Task } from '../models/task.model.js';
import type { AuthenticatedUser, RequestActor } from '../types/context.js';
import type { Lean } from '../types/lean.js';
import { buildDiff, recordAudit } from './audit.service.js';
import { accessibleClientIds } from './compliance.service.js';
import { createNotification } from './notification.service.js';

export const TASK_SORT_FIELDS = ['dueDate', 'priority', 'createdAt', 'status'] as const;

export interface TaskListQuery {
  q?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  client?: string;
  overdue?: boolean;
  dueFrom?: Date;
  dueTo?: Date;
  sort?: string;
}

const POPULATE = [
  { path: 'client', select: 'displayName clientType' },
  { path: 'assignee', select: 'name email role' },
  { path: 'complianceItem', select: 'periodLabel dueDate status' },
] as const;

export const buildTaskFilter = async (
  user: AuthenticatedUser,
  query: TaskListQuery,
): Promise<QueryFilter<TaskAttributes>> => {
  const filter: QueryFilter<TaskAttributes> = {};
  const scoped = await accessibleClientIds(user);

  if (query.client) {
    if (scoped !== null && !scoped.some((id) => id.toString() === query.client)) {
      throw notFound('client');
    }
    filter.client = query.client;
  } else if (scoped !== null) {
    filter.$or = [{ client: { $in: scoped } }, { client: null, assignee: user.id }];
  }

  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.assignee) filter.assignee = query.assignee;
  if (query.dueFrom || query.dueTo) {
    filter.dueDate = {
      ...(query.dueFrom ? { $gte: query.dueFrom } : {}),
      ...(query.dueTo ? { $lte: query.dueTo } : {}),
    };
  }
  if (query.overdue === true) {
    filter.status = { $ne: 'done' };
    filter.dueDate = { ...(filter.dueDate as object), $lt: todayIST() };
  }
  if (query.q && query.q.trim().length > 0) {
    filter.title = new RegExp(escapeRegex(query.q.trim()), 'i');
  }
  return filter;
};

export const listTasks = async (
  user: AuthenticatedUser,
  query: TaskListQuery,
  page: PageRequest,
): Promise<{ items: Lean<TaskAttributes>[]; total: number }> => {
  const filter = await buildTaskFilter(user, query);
  const sort = withTiebreak(
    parseSort<(typeof TASK_SORT_FIELDS)[number]>(query.sort, TASK_SORT_FIELDS, { dueDate: 1 }),
  );
  const [items, total] = await Promise.all([
    Task.find(filter)
      .sort(sort)
      .skip(page.skip)
      .limit(page.limit)
      .populate([...POPULATE])
      .lean<Lean<TaskAttributes>[]>()
      .exec(),
    Task.countDocuments(filter).exec(),
  ]);
  return { items, total };
};

export const getTask = async (id: Types.ObjectId): Promise<Lean<TaskAttributes>> => {
  const record = await Task.findById(id)
    .populate([...POPULATE])
    .populate('blockedBy', 'title status dueDate')
    .lean<Lean<TaskAttributes> | null>()
    .exec();
  if (!record) throw notFound('task');
  return record;
};

export const clientIdOfTask = async (id: Types.ObjectId): Promise<Types.ObjectId | null> => {
  const record = await Task.findById(id).select('client').lean().exec();
  if (!record) throw notFound('task');
  return record.client ?? null;
};

export const assertNoCycle = async (
  taskId: Types.ObjectId | null,
  blockedBy: readonly string[],
): Promise<void> => {
  if (blockedBy.length === 0) return;
  const seen = new Set<string>(taskId ? [taskId.toString()] : []);
  let frontier = blockedBy.map((id) => id.toString());

  while (frontier.length > 0) {
    const chain = frontier.filter((id) => seen.has(id));
    if (chain.length > 0) {
      throw conflict(
        'These dependencies form a loop, so none of the tasks could ever start. Remove one link in the chain.',
      );
    }
    for (const id of frontier) seen.add(id);
    const next = await Task.find({ _id: { $in: frontier } })
      .select('blockedBy')
      .lean()
      .exec();
    frontier = next.flatMap((task) => task.blockedBy.map((id) => id.toString()));
  }
};

const assertAssigneeAllowed = async (
  actor: AuthenticatedUser,
  clientId: Types.ObjectId | null,
  assigneeId: string,
): Promise<void> => {
  if (actor.role === 'admin') return;
  if (clientId === null) {
    if (!sameId(actor.id, assigneeId)) {
      throw forbidden('You can only assign internal work to yourself.');
    }
    return;
  }
  const client = await Client.findById(clientId).select('assignedStaff').lean().exec();
  if (!client) throw notFound('client');
  if (!containsId(client.assignedStaff, assigneeId)) {
    throw forbidden(
      'That person is not assigned to this client, so handing the task over would widen their access.',
    );
  }
};

const assertAttachmentsBelong = async (
  clientId: Types.ObjectId | null,
  attachmentIds: readonly string[],
): Promise<void> => {
  if (attachmentIds.length === 0) return;
  if (clientId === null) {
    throw validationFailed('Internal tasks cannot carry client documents.', [
      { field: 'attachments', message: 'Choose a client before attaching documents.' },
    ]);
  }
  const count = await DocumentModel.countDocuments({
    _id: { $in: [...attachmentIds] },
    client: clientId,
  }).exec();
  if (count !== new Set(attachmentIds).size) {
    throw validationFailed('Every attachment must already belong to this client.', [
      { field: 'attachments', message: 'One of these documents belongs to another client.' },
    ]);
  }
};

export interface TaskWrite {
  title?: string;
  description?: string | null;
  clientId?: string | null;
  complianceItemId?: string | null;
  assigneeId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date | null;
  internalOnly?: boolean;
  checklist?: Array<{ title: string; done: boolean }>;
  blockedBy?: string[];
  estimateMinutes?: number | null;
  loggedMinutes?: number;
  attachments?: string[];
  recurrence?: TaskAttributes['recurrence'];
}

export const createTask = async (
  payload: TaskWrite,
  user: AuthenticatedUser,
  actor: RequestActor,
): Promise<Lean<TaskAttributes>> => {
  if (payload.title === undefined || payload.assigneeId === undefined) {
    throw validationFailed('A task needs a title and one assignee.', [
      { field: 'title', message: 'Give the task a title the client can read.' },
    ]);
  }
  const clientId = payload.clientId ? new (await import('mongoose')).Types.ObjectId(payload.clientId) : null;
  await assertAssigneeAllowed(user, clientId, payload.assigneeId);
  await assertAttachmentsBelong(clientId, payload.attachments ?? []);
  await assertNoCycle(null, payload.blockedBy ?? []);

  const created = await Task.create({
    title: payload.title,
    description: payload.description ?? null,
    client: clientId,
    complianceItem: payload.complianceItemId ?? null,
    assignee: payload.assigneeId,
    status: payload.status ?? 'not_started',
    priority: payload.priority ?? 'normal',
    dueDate: payload.dueDate ?? null,
    internalOnly: payload.internalOnly ?? false,
    checklist: payload.checklist ?? [],
    blockedBy: payload.blockedBy ?? [],
    estimateMinutes: payload.estimateMinutes ?? null,
    loggedMinutes: payload.loggedMinutes ?? 0,
    attachments: payload.attachments ?? [],
    recurrence: payload.recurrence ?? null,
    createdBy: actor.id,
    updatedBy: actor.id,
  });

  await recordAudit({
    actor,
    action: 'create',
    entityKind: 'task',
    entityId: created._id,
    client: clientId,
    summary: `Created task ${created.title}`,
  });
  await notifyAssignment(created._id, created.title, payload.assigneeId, user, 'task_assigned');
  return getTask(created._id);
};

const notifyAssignment = async (
  taskId: Types.ObjectId,
  title: string,
  assigneeId: string,
  actingUser: AuthenticatedUser,
  type: 'task_assigned' | 'task_reassigned',
): Promise<void> => {
  if (sameId(actingUser.id, assigneeId)) return;
  const { Types } = await import('mongoose');
  await createNotification({
    recipient: new Types.ObjectId(assigneeId),
    type,
    title,
    body:
      type === 'task_assigned'
        ? `${actingUser.name} assigned this task to you.`
        : `${actingUser.name} moved this task to you.`,
    link: `/tasks/${taskId.toString()}`,
    entity: { kind: 'task', id: taskId },
  });
};

const WRITABLE = [
  'title',
  'description',
  'complianceItem',
  'status',
  'priority',
  'dueDate',
  'internalOnly',
  'checklist',
  'blockedBy',
  'estimateMinutes',
  'loggedMinutes',
  'attachments',
  'recurrence',
] as const;

export const updateTask = async (
  id: Types.ObjectId,
  payload: TaskWrite,
  user: AuthenticatedUser,
  actor: RequestActor,
): Promise<Lean<TaskAttributes>> => {
  const doc = await Task.findById(id).exec();
  if (!doc) throw notFound('task');
  if (payload.clientId !== undefined) {
    throw conflict('A task cannot be moved to a different client. Create a new task instead.');
  }
  if (payload.blockedBy) await assertNoCycle(doc._id, payload.blockedBy);
  if (payload.attachments) await assertAttachmentsBelong(doc.client ?? null, payload.attachments);
  if (payload.assigneeId !== undefined) {
    await assertAssigneeAllowed(user, doc.client ?? null, payload.assigneeId);
  }

  const before: Record<string, unknown> = {};
  for (const field of WRITABLE) before[field] = doc.get(field);
  before.assignee = doc.assignee;

  if (payload.complianceItemId !== undefined) doc.set('complianceItem', payload.complianceItemId);
  if (payload.assigneeId !== undefined) doc.set('assignee', payload.assigneeId);
  for (const field of WRITABLE) {
    if (field === 'complianceItem') continue;
    const value = payload[field as keyof TaskWrite];
    if (value !== undefined) doc.set(field, value);
  }
  doc.set('updatedBy', actor.id);
  await doc.save();

  const after: Record<string, unknown> = {};
  for (const field of WRITABLE) after[field] = doc.get(field);
  after.assignee = doc.assignee;

  const diff = buildDiff(before, after);
  if (diff.length > 0) {
    await recordAudit({
      actor,
      action: 'update',
      entityKind: 'task',
      entityId: doc._id,
      client: doc.client ?? null,
      summary: `Updated task ${doc.title}`,
      diff,
    });
  }
  return getTask(id);
};

export const assignTask = async (
  id: Types.ObjectId,
  assigneeId: string,
  user: AuthenticatedUser,
  actor: RequestActor,
): Promise<Lean<TaskAttributes>> => {
  const doc = await Task.findById(id).exec();
  if (!doc) throw notFound('task');
  if (user.role !== 'admin' && !sameId(doc.assignee, user.id)) {
    throw forbidden('You can only hand over a task you currently own.');
  }
  await assertAssigneeAllowed(user, doc.client ?? null, assigneeId);

  const previous = doc.assignee;
  doc.set('assignee', assigneeId);
  doc.set('updatedBy', actor.id);
  await doc.save();

  await recordAudit({
    actor,
    action: 'assign',
    entityKind: 'task',
    entityId: doc._id,
    client: doc.client ?? null,
    summary: `Reassigned task ${doc.title}`,
    diff: buildDiff({ assignee: previous }, { assignee: doc.assignee }),
  });
  await notifyAssignment(doc._id, doc.title, assigneeId, user, 'task_reassigned');
  if (!sameId(previous, assigneeId) && !sameId(previous, user.id)) {
    await createNotification({
      recipient: previous,
      type: 'task_reassigned',
      title: doc.title,
      body: `${user.name} moved this task away from you.`,
      link: `/tasks/${doc._id.toString()}`,
      entity: { kind: 'task', id: doc._id },
    });
  }
  return getTask(id);
};

export const changeTaskStatus = async (
  id: Types.ObjectId,
  status: TaskStatus,
  actor: RequestActor,
): Promise<Lean<TaskAttributes>> => {
  const doc = await Task.findById(id).exec();
  if (!doc) throw notFound('task');
  const before = { status: doc.status, completedAt: doc.completedAt };
  doc.status = status;
  doc.set('updatedBy', actor.id);
  await doc.save();
  await recordAudit({
    actor,
    action: 'status_change',
    entityKind: 'task',
    entityId: doc._id,
    client: doc.client ?? null,
    summary: `Task moved from ${before.status} to ${status}`,
    diff: buildDiff(before, { status: doc.status, completedAt: doc.completedAt }),
  });
  return getTask(id);
};

export const deleteTask = async (id: Types.ObjectId, actor: RequestActor): Promise<void> => {
  const doc = await Task.findById(id).exec();
  if (!doc) throw notFound('task');
  const clientId = doc.client ?? null;
  const title = doc.title;
  await doc.deleteOne();
  const { TaskComment } = await import('../models/taskComment.model.js');
  await TaskComment.deleteMany({ task: id }).exec();
  await recordAudit({
    actor,
    action: 'hard_delete',
    entityKind: 'task',
    entityId: id,
    client: clientId,
    summary: `Deleted task ${title}`,
  });
};

export const blockingReasons = async (
  id: Types.ObjectId,
): Promise<Array<{ id: string; title: string; status: TaskStatus }>> => {
  const doc = await Task.findById(id).select('blockedBy').lean().exec();
  if (!doc || doc.blockedBy.length === 0) return [];
  const blockers = await Task.find({ _id: { $in: doc.blockedBy }, status: { $ne: 'done' } })
    .select('title status')
    .lean()
    .exec();
  return blockers.map((blocker) => ({
    id: blocker._id.toString(),
    title: blocker.title,
    status: blocker.status,
  }));
};
