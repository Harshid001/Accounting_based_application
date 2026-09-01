import { apiList } from '@/api/client';
import type { Paged, QueryParams } from '@/types/api';
import type { AuditEntry } from '@/types/models';

export const listAuditEntries = (
  params: QueryParams,
  signal?: AbortSignal,
): Promise<Paged<AuditEntry>> =>
  apiList<AuditEntry>('/audit', {
    method: 'GET',
    query: params,
    ...(signal ? { signal } : {}),
  });
