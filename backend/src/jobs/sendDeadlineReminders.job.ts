import { addDays, differenceInDays, formatDisplayDate, todayIST } from '../lib/date.js';
import { CLOSED_COMPLIANCE_STATUSES } from '../lib/enums.js';
import { appLink, sendMail } from '../email/send.js';
import { renderDeadlineReminder } from '../email/templates/deadlineReminder.js';
import type { DeadlineReminderRow } from '../email/templates/deadlineReminder.js';
import { ComplianceItem } from '../models/complianceItem.model.js';
import { User } from '../models/user.model.js';
import { createNotification } from '../services/notification.service.js';
import { firmName, reminderOffsetsFallback } from '../services/settings.service.js';
import { runWithLock } from './lock.js';
import type { JobOutcome } from './lock.js';

const nameOf = (value: unknown, key: string): string | null => {
  if (value === null || value === undefined || typeof value !== 'object') return null;
  const found = (value as Record<string, unknown>)[key];
  return typeof found === 'string' ? found : null;
};

export const sendDeadlineReminders = async (): Promise<JobOutcome> =>
  runWithLock('sendDeadlineReminders', async () => {
    const today = todayIST();
    const fallbackOffsets = await reminderOffsetsFallback();
    const horizon = Math.max(...fallbackOffsets, 30);

    const items = await ComplianceItem.find({
      status: { $nin: CLOSED_COMPLIANCE_STATUSES },
      assignedStaff: { $ne: null },
      dueDate: { $gte: today, $lte: addDays(today, horizon) },
    })
      .populate('client', 'displayName')
      .populate('complianceType', 'name reminderOffsetsDays')
      .lean()
      .exec();

    const perStaff = new Map<string, DeadlineReminderRow[]>();
    let notifications = 0;

    for (const item of items) {
      if (!item.assignedStaff) continue;
      const offsets = (item.complianceType as unknown as { reminderOffsetsDays?: number[] })
        .reminderOffsetsDays ?? fallbackOffsets;
      const daysRemaining = differenceInDays(item.dueDate, today);
      if (!offsets.includes(daysRemaining)) continue;

      const key = item.assignedStaff.toString();
      const row: DeadlineReminderRow = {
        clientName: nameOf(item.client, 'displayName') ?? 'Unknown client',
        complianceTypeName: nameOf(item.complianceType, 'name') ?? 'Filing',
        periodLabel: item.periodLabel,
        dueDate: formatDisplayDate(item.dueDate),
        daysRemaining,
      };
      perStaff.set(key, [...(perStaff.get(key) ?? []), row]);

      await createNotification({
        recipient: item.assignedStaff,
        type: 'deadline_due',
        title: `${row.complianceTypeName} — ${row.clientName}`,
        body: `${row.periodLabel} is due ${row.dueDate}.`,
        link: `/compliance/${item._id.toString()}`,
        entity: { kind: 'complianceItem', id: item._id },
        dedupeKey: `deadline:${item._id.toString()}:${key}:${daysRemaining}`,
      });
      notifications += 1;
    }

    const name = await firmName();
    let emailed = 0;
    for (const [staffId, rows] of perStaff) {
      const staff = await User.findById(staffId)
        .select('name email status notificationPreferences')
        .lean()
        .exec();
      if (!staff || staff.status !== 'active') continue;
      const delivered = await sendMail({
        to: staff.email,
        category: 'deadline_reminder',
        preferences: staff.notificationPreferences,
        rendered: renderDeadlineReminder({
          firmName: name,
          recipientName: staff.name,
          rows: rows.sort((a, b) => a.daysRemaining - b.daysRemaining),
          workUrl: appLink('/my-work'),
        }),
      });
      if (delivered) emailed += 1;
    }

    return { notifications, emailed, staffNotified: perStaff.size };
  });
