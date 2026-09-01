import { z } from 'zod';

import { TASK_PRIORITIES, TASK_RECURRENCE_FREQUENCIES, TASK_STATUSES } from '@/types/enums';

const optionalDate = z
  .string()
  .trim()
  .refine(
    (value) => value.length === 0 || /^\d{4}-\d{2}-\d{2}$/.test(value),
    'Enter a date like 29 Jul 2026.',
  );

export const taskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Give the task a title of at least three characters.')
    .max(200, 'Keep the title under 200 characters.'),
  description: z.string().trim().max(8000, 'Keep the description under 8000 characters.'),
  clientId: z.string().trim(),
  complianceItemId: z.string().trim(),
  assigneeId: z.string().trim().min(1, 'Choose who owns this task.'),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  dueDate: optionalDate,
  internalOnly: z.boolean(),
  estimateMinutes: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || /^\d{1,6}$/.test(value),
      'Enter the estimate in whole minutes.',
    ),
  recurrenceEnabled: z.boolean(),
  recurrenceFrequency: z.enum(TASK_RECURRENCE_FREQUENCIES),
  recurrenceInterval: z
    .string()
    .trim()
    .refine((value) => /^\d{1,2}$/.test(value), 'Repeat every 1 to 52.'),
  recurrenceNextRunAt: optionalDate,
});

export type TaskFormValues = z.infer<typeof taskSchema>;

export const emptyTask: TaskFormValues = {
  title: '',
  description: '',
  clientId: '',
  complianceItemId: '',
  assigneeId: '',
  status: 'not_started',
  priority: 'normal',
  dueDate: '',
  internalOnly: false,
  estimateMinutes: '',
  recurrenceEnabled: false,
  recurrenceFrequency: 'monthly',
  recurrenceInterval: '1',
  recurrenceNextRunAt: '',
};

const orNull = (value: string): string | null => (value.trim().length === 0 ? null : value.trim());

export const toTaskPayload = (
  values: TaskFormValues,
  options: { includeClient: boolean },
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    title: values.title,
    description: orNull(values.description),
    complianceItemId: orNull(values.complianceItemId),
    assigneeId: values.assigneeId,
    status: values.status,
    priority: values.priority,
    dueDate: orNull(values.dueDate),
    internalOnly: values.internalOnly,
    estimateMinutes:
      values.estimateMinutes.trim().length === 0
        ? null
        : Number.parseInt(values.estimateMinutes, 10),
    recurrence:
      values.recurrenceEnabled && values.recurrenceNextRunAt.length > 0
        ? {
            frequency: values.recurrenceFrequency,
            interval: Number.parseInt(values.recurrenceInterval, 10),
            nextRunAt: values.recurrenceNextRunAt,
            endDate: null,
          }
        : null,
  };

  if (options.includeClient) payload.clientId = orNull(values.clientId);

  return payload;
};

export const taskCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Write something before posting.')
    .max(4000, 'Keep a comment under 4000 characters.'),
});
export type TaskCommentValues = z.infer<typeof taskCommentSchema>;
