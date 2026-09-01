import { apiList } from '@/api/client';
import type { Paged, QueryParams } from '@/types/api';
import type { WorkRow } from '@/types/models';

export const listMyWork = (params: QueryParams, signal?: AbortSignal): Promise<Paged<WorkRow>> =>
  apiList<WorkRow>('/my-work', {
    method: 'GET',
    query: params,
    ...(signal ? { signal } : {}),
  });
