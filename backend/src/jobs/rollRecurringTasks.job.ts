import { addDays, addMonths, todayIST } from '../lib/date.js';
import type { TaskRecurrenceFrequency } from '../lib/enums.js';
import { Task } from '../models/task.model.js';
import { createNotification } from '../services/notification.service.js';
import { runWithLock } from './lock.js';
import type { JobOutcome } from './lock.js';

export const advance = (
  from: Date,
  frequency: TaskRecurrenceFrequency,
  interval: number,
): Date => {
  switch (frequency) {
    case 'daily':
      return addDays(from, interval);
    case 'weekly':
      return addDays(from, 7 * interval);
    case 'monthly':
      return addMonths(from, interval);
    case 'quarterly':
      return addMonths(from, 3 * interval);
    case 'annual':
      return addMonths(from, 12 * interval);
  }
};

export const rollRecurringTasks = async (): Promise<JobOutcome> =>
  runWithLock('rollRecurringTasks', async () => {
    const today = todayIST();
    const due = await Task.find({ 'recurrence.nextRunAt': { $lte: today } }).exec();

    let created = 0;
    let retired = 0;

    for (const template of due) {
      const recurrence = template.recurrence;
      if (!recurrence) continue;

      if (recurrence.endDate && recurrence.nextRunAt > recurrence.endDate) {
        template.set('recurrence', null);
        await template.save();
        retired += 1;
        continue;
      }

      const occurrence = await Task.create({
        title: template.title,
        description: template.description,
        client: template.client,
        complianceItem: null,
        assignee: template.assignee,
        status: 'not_started',
        priority: template.priority,
        dueDate: recurrence.nextRunAt,
        internalOnly: template.internalOnly,
        checklist: template.checklist.map((entry) => ({ title: entry.title, done: false })),
        blockedBy: [],
        estimateMinutes: template.estimateMinutes,
        loggedMinutes: 0,
        attachments: [],
        recurrence: null,
        createdBy: template.createdBy,
        updatedBy: template.updatedBy,
      });
      created += 1;

      await createNotification({
        recipient: template.assignee,
        type: 'task_assigned',
        title: occurrence.title,
        body: 'A recurring task has come around again.',
        link: `/tasks/${occurrence._id.toString()}`,
        entity: { kind: 'task', id: occurrence._id },
        dedupeKey: `recurring:${occurrence._id.toString()}`,
      });

      const next = advance(recurrence.nextRunAt, recurrence.frequency, recurrence.interval);
      if (recurrence.endDate && next > recurrence.endDate) {
        template.set('recurrence', null);
        retired += 1;
      } else {
        template.set('recurrence.nextRunAt', next);
      }
      await template.save();
    }

    return { created, retired };
  });
