import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import type { JobName } from '../lib/enums.js';
import { generateComplianceItems } from './generateComplianceItems.job.js';
import { purgeUnlinkedAccounts } from './purgeUnlinkedAccounts.job.js';
import { rollRecurringTasks } from './rollRecurringTasks.job.js';
import { sendAdminDigest } from './sendAdminDigest.job.js';
import { sendDeadlineReminders } from './sendDeadlineReminders.job.js';
import type { JobOutcome } from './lock.js';

export const JOB_REGISTRY: Record<JobName, () => Promise<JobOutcome>> = {
  generateComplianceItems,
  sendDeadlineReminders,
  sendAdminDigest,
  purgeUnlinkedAccounts,
  rollRecurringTasks,
};

const SCHEDULE: Record<JobName, string> = {
  generateComplianceItems: '0 2 * * *',
  rollRecurringTasks: '30 2 * * *',
  purgeUnlinkedAccounts: '0 3 * * *',
  sendDeadlineReminders: '0 7 * * *',
  sendAdminDigest: '0 8 * * *',
};

let tasks: ScheduledTask[] = [];

export const startScheduler = (): void => {
  if (!env.SCHEDULER_ENABLED) {
    logger.info(
      { event: 'scheduler.disabled' },
      'scheduler is switched off; jobs run only through the admin trigger',
    );
    return;
  }
  tasks = (Object.keys(SCHEDULE) as JobName[]).map((jobName) =>
    cron.schedule(
      SCHEDULE[jobName],
      () => {
        void JOB_REGISTRY[jobName]().catch((error: unknown) => {
          logger.error({ event: 'scheduler.error', jobName, err: error }, 'scheduled job threw');
        });
      },
      { timezone: env.SCHEDULER_TIMEZONE },
    ),
  );
  logger.info(
    { event: 'scheduler.started', jobs: Object.keys(SCHEDULE), timezone: env.SCHEDULER_TIMEZONE },
    'scheduler started',
  );
};

export const stopScheduler = async (): Promise<void> => {
  for (const task of tasks) {
    await task.destroy();
  }
  tasks = [];
};
