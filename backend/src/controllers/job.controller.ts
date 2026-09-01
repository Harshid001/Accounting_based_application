import type { z } from 'zod';

import { conflict } from '../lib/errors.js';
import { sendData, sendList } from '../lib/http.js';
import { buildPageMeta, toPageRequest } from '../lib/pagination.js';
import { JOB_REGISTRY } from '../jobs/index.js';
import { jobIsLocked } from '../jobs/lock.js';
import type { RouteContext } from '../middleware/validate.js';
import { JobRun } from '../models/jobRun.model.js';
import type { jobListQuery, jobNameParam } from '../validators/user.validators.js';

type ListQuery = z.infer<typeof jobListQuery>;
type NameParam = z.infer<typeof jobNameParam>;

export const list = async (
  input: { query: ListQuery },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const filter = input.query.jobName ? { jobName: input.query.jobName } : {};
  const [items, total] = await Promise.all([
    JobRun.find(filter).sort({ startedAt: -1 }).skip(page.skip).limit(page.limit).lean().exec(),
    JobRun.countDocuments(filter).exec(),
  ]);
  sendList(
    ctx.res,
    items.map((run) => ({
      id: run._id.toString(),
      jobName: run.jobName,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
      durationMs: run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null,
      result: run.result ?? null,
      error: run.error ?? null,
    })),
    buildPageMeta(total, page),
  );
};

export const run = async (
  input: { params: NameParam },
  ctx: RouteContext,
): Promise<void> => {
  const jobName = input.params.name;
  if (await jobIsLocked(jobName)) {
    throw conflict('That job is already running. Wait for it to finish, then try again.');
  }
  const outcome = await JOB_REGISTRY[jobName]();
  if (!outcome.ran) {
    throw conflict('That job is already running. Wait for it to finish, then try again.');
  }
  sendData(ctx.res, {
    jobName,
    result: outcome.result,
    error: outcome.error ?? null,
  });
};
