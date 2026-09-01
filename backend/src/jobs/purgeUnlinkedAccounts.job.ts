import { purgeUnlinkedAccounts as purge } from '../services/user.service.js';
import { systemActor } from '../types/context.js';
import { runWithLock } from './lock.js';
import type { JobOutcome } from './lock.js';

export const PURGE_AFTER_DAYS = 30;

export const purgeUnlinkedAccounts = async (): Promise<JobOutcome> =>
  runWithLock('purgeUnlinkedAccounts', async () => {
    const deleted = await purge(PURGE_AFTER_DAYS, systemActor());
    return { deleted };
  });
