import { logger } from '../config/logger.js';
import type { JobName } from '../lib/enums.js';
import { JobRun } from '../models/jobRun.model.js';

const DEFAULT_LEASE_MS = 15 * 60 * 1000;

export interface JobOutcome {
  ran: boolean;
  result: Record<string, number>;
  error?: string;
}

export const runWithLock = async (
  jobName: JobName,
  work: () => Promise<Record<string, number>>,
  leaseMs: number = DEFAULT_LEASE_MS,
): Promise<JobOutcome> => {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + leaseMs);

  const run = await JobRun.findOneAndUpdate(
    { jobName, lockedUntil: { $lt: now } },
    {
      $set: {
        jobName,
        status: 'running',
        startedAt: now,
        finishedAt: null,
        lockedUntil,
        error: null,
      },
    },
    { returnDocument: 'after', upsert: false },
  ).exec();

  let record = run;
  if (!record) {
    const existing = await JobRun.findOne({ jobName }).sort({ startedAt: -1 }).exec();
    if (existing) {
      logger.debug(
        { event: 'job.locked', jobName },
        'another instance holds this job lock; skipping',
      );
      return { ran: false, result: {} };
    }
    record = await JobRun.create({
      jobName,
      status: 'running',
      startedAt: now,
      lockedUntil,
    });
  }

  try {
    const result = await work();
    record.status = 'succeeded';
    record.finishedAt = new Date();
    record.lockedUntil = new Date(0);
    record.result = result;
    await record.save();
    logger.info({ event: 'job.finished', jobName, result }, 'scheduled job completed');
    return { ran: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown failure';
    record.status = 'failed';
    record.finishedAt = new Date();
    record.lockedUntil = new Date(0);
    record.error = message.slice(0, 1000);
    await record.save();
    logger.error({ event: 'job.failed', jobName, err: error }, 'scheduled job failed');
    return { ran: true, result: {}, error: message };
  }
};

export const jobIsLocked = async (jobName: JobName): Promise<boolean> => {
  const held = await JobRun.findOne({ jobName, lockedUntil: { $gte: new Date() } })
    .select('_id')
    .lean()
    .exec();
  return held !== null;
};
