import { todayIST } from '../lib/date.js';
import type { TaskAttributes } from '../models/task.model.js';
import type { TaskCommentAttributes } from '../models/taskComment.model.js';
import type { Lean } from '../types/lean.js';
import { dateOnly, namedRef, personRef, timestamp } from './common.js';
import type { NamedRef, PersonRef } from './common.js';

type TaskRecord = Lean<TaskAttributes>;

export interface TaskListRow {
  id: string;
  title: string;
  client: NamedRef | null;
  assignee: PersonRef | null;
  status: string;
  priority: string;
  dueDate: string | null;
  isOverdue: boolean;
  internalOnly: boolean;
  checklistDone: number;
  checklistTotal: number;
  blockedCount: number;
}

export const serialiseTaskRow = (task: TaskRecord): TaskListRow => ({
  id: task._id.toString(),
  title: task.title,
  client: namedRef(task.client, 'displayName'),
  assignee: personRef(task.assignee),
  status: task.status,
  priority: task.priority,
  dueDate: dateOnly(task.dueDate),
  isOverdue:
    task.status !== 'done' &&
    task.dueDate !== null &&
    task.dueDate !== undefined &&
    task.dueDate.getTime() < todayIST().getTime(),
  internalOnly: task.internalOnly,
  checklistDone: task.checklist.filter((entry) => entry.done).length,
  checklistTotal: task.checklist.length,
  blockedCount: task.blockedBy.length,
});

export interface TaskDetail extends TaskListRow {
  description: string | null;
  complianceItem: { id: string; periodLabel: string | null } | null;
  checklist: Array<{ id: string; title: string; done: boolean }>;
  blockedBy: Array<{ id: string; title: string; status: string }>;
  estimateMinutes: number | null;
  loggedMinutes: number;
  attachments: string[];
  recurrence: TaskAttributes['recurrence'];
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

const blockerRef = (value: unknown): { id: string; title: string; status: string } | null => {
  const ref = namedRef(value, 'title');
  if (ref === null) return null;
  const record = value as { status?: unknown };
  return {
    id: ref.id,
    title: ref.name,
    status: typeof record.status === 'string' ? record.status : 'not_started',
  };
};

export const serialiseTaskDetail = (task: TaskRecord): TaskDetail => ({
  ...serialiseTaskRow(task),
  description: task.description ?? null,
  complianceItem:
    task.complianceItem === null || task.complianceItem === undefined
      ? null
      : {
          id: namedRef(task.complianceItem, 'periodLabel')?.id ?? '',
          periodLabel: namedRef(task.complianceItem, 'periodLabel')?.name ?? null,
        },
  checklist: task.checklist.map((entry) => ({
    id: entry._id.toString(),
    title: entry.title,
    done: entry.done,
  })),
  blockedBy: task.blockedBy
    .map((value) => blockerRef(value))
    .filter((value): value is { id: string; title: string; status: string } => value !== null),
  estimateMinutes: task.estimateMinutes ?? null,
  loggedMinutes: task.loggedMinutes,
  attachments: task.attachments.map((id) => id.toString()),
  recurrence: task.recurrence ?? null,
  completedAt: timestamp(task.completedAt),
  createdAt: timestamp(task.createdAt),
  updatedAt: timestamp(task.updatedAt),
});

export interface PortalTaskRow {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
}

export const serialiseTaskForPortal = (task: TaskRecord): PortalTaskRow => ({
  id: task._id.toString(),
  title: task.title,
  status: task.status,
  dueDate: dateOnly(task.dueDate),
});

export interface TaskCommentView {
  id: string;
  body: string;
  author: PersonRef | null;
  editedAt: string | null;
  createdAt: string | null;
}

export const serialiseTaskComment = (
  comment: Lean<TaskCommentAttributes>,
): TaskCommentView => ({
  id: comment._id.toString(),
  body: comment.body,
  author: personRef(comment.author),
  editedAt: timestamp(comment.editedAt),
  createdAt: timestamp(comment.createdAt),
});
