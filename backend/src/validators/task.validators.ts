import { z } from 'zod';

import {
  TASK_PRIORITIES,
  TASK_RECURRENCE_FREQUENCIES,
  TASK_STATUSES,
} from '../lib/enums.js';
import {
  dateOnlyString,
  nullableDateOnly,
  nullableText,
  objectId,
  optionalBooleanQuery,
  optionalDateOnly,
  pageQuery,
  searchTerm,
  sortParam,
  trimmedString,
} from './common.validators.js';

export const taskListQuery = pageQuery.extend({
  q: searchTerm,
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assignee: objectId.optional(),
  client: objectId.optional(),
  overdue: optionalBooleanQuery,
  dueFrom: optionalDateOnly,
  dueTo: optionalDateOnly,
  sort: sortParam,
});

const recurrenceSchema = z.union([
  z.object({
    frequency: z.enum(TASK_RECURRENCE_FREQUENCIES),
    interval: z.coerce.number().int().min(1).max(52).default(1),
    nextRunAt: dateOnlyString,
    endDate: nullableDateOnly,
  }),
  z.null(),
]);

const checklistSchema = z
  .array(z.object({ title: trimmedString(1, 200), done: z.boolean().default(false) }))
  .max(50);

export const createTaskBody = z.object({
  title: trimmedString(3, 200),
  description: nullableText(8000),
  clientId: z.union([objectId, z.null()]).optional(),
  complianceItemId: z.union([objectId, z.null()]).optional(),
  assigneeId: objectId,
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueDate: nullableDateOnly,
  internalOnly: z.boolean().optional(),
  checklist: checklistSchema.optional(),
  blockedBy: z.array(objectId).max(20).optional(),
  estimateMinutes: z.union([z.coerce.number().int().min(0).max(100_000), z.null()]).optional(),
  loggedMinutes: z.coerce.number().int().min(0).max(100_000).optional(),
  attachments: z.array(objectId).max(50).optional(),
  recurrence: recurrenceSchema.optional(),
});

export const updateTaskBody = createTaskBody.partial().omit({ clientId: true });

export const assignTaskBody = z.object({ assigneeId: objectId });

export const taskStatusBody = z.object({ status: z.enum(TASK_STATUSES) });

export const commentBody = z.object({ body: trimmedString(1, 4000) });

export const myWorkQuery = pageQuery;

export type CreateTaskBody = z.infer<typeof createTaskBody>;
export type UpdateTaskBody = z.infer<typeof updateTaskBody>;
