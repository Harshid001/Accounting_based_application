import { apiList, apiPost } from '@/api/client';
import type { Paged, QueryParams } from '@/types/api';
import type { JobName } from '@/types/enums';
import type { JobRunOutcome, JobRunView } from '@/types/models';

export const listJobRuns = (params: QueryParams): Promise<Paged<JobRunView>> =>
  apiList<JobRunView>('/jobs', { method: 'GET', query: params });

export const runJob = (name: JobName): Promise<JobRunOutcome> =>
  apiPost<JobRunOutcome>(`/jobs/${name}/run`);
