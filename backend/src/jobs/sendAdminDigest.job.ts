import { addDays, formatDisplayDate, todayIST } from '../lib/date.js';
import { CLOSED_COMPLIANCE_STATUSES } from '../lib/enums.js';
import { appLink, sendMail } from '../email/send.js';
import { renderAdminDigest } from '../email/templates/adminDigest.js';
import { ComplianceItem } from '../models/complianceItem.model.js';
import { DocumentRequest } from '../models/documentRequest.model.js';
import { User } from '../models/user.model.js';
import { firmName } from '../services/settings.service.js';
import { runWithLock } from './lock.js';
import type { JobOutcome } from './lock.js';

const nameOf = (value: unknown, key: string): string | null => {
  if (value === null || value === undefined || typeof value !== 'object') return null;
  const found = (value as Record<string, unknown>)[key];
  return typeof found === 'string' ? found : null;
};

export const sendAdminDigest = async (): Promise<JobOutcome> =>
  runWithLock('sendAdminDigest', async () => {
    const today = todayIST();
    const open = { status: { $nin: CLOSED_COMPLIANCE_STATUSES } };

    const [overdueCount, dueThisWeekCount, awaitingClientCount, openRequestCount, topOverdue] =
      await Promise.all([
        ComplianceItem.countDocuments({ ...open, dueDate: { $lt: today } }).exec(),
        ComplianceItem.countDocuments({
          ...open,
          dueDate: { $gte: today, $lte: addDays(today, 7) },
        }).exec(),
        ComplianceItem.countDocuments({ status: 'awaiting_client' }).exec(),
        DocumentRequest.countDocuments({ status: 'open' }).exec(),
        ComplianceItem.find({ ...open, dueDate: { $lt: today } })
          .sort({ dueDate: 1 })
          .limit(10)
          .populate('client', 'displayName')
          .populate('complianceType', 'name')
          .lean()
          .exec(),
      ]);

    const admins = await User.find({ role: 'admin', status: 'active' })
      .select('name email notificationPreferences')
      .lean()
      .exec();
    const name = await firmName();

    let emailed = 0;
    for (const admin of admins) {
      const delivered = await sendMail({
        to: admin.email,
        category: 'daily_digest',
        preferences: admin.notificationPreferences,
        rendered: renderAdminDigest({
          firmName: name,
          recipientName: admin.name,
          overdueCount,
          dueThisWeekCount,
          awaitingClientCount,
          openRequestCount,
          topOverdue: topOverdue.map((item) => ({
            clientName: nameOf(item.client, 'displayName') ?? 'Unknown client',
            complianceTypeName: nameOf(item.complianceType, 'name') ?? 'Filing',
            dueDate: formatDisplayDate(item.dueDate),
          })),
          dashboardUrl: appLink('/dashboard'),
        }),
      });
      if (delivered) emailed += 1;
    }

    return { admins: admins.length, emailed, overdueCount, dueThisWeekCount };
  });
