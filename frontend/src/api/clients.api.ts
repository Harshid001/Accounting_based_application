import { apiDelete, apiGet, apiList, apiPatch, apiPost, apiPut } from '@/api/client';
import { csvFilename, downloadCsv } from '@/lib/download';
import type { Paged, QueryParams } from '@/types/api';
import type {
  AssignmentResult,
  AuditEntry,
  ClientDetail,
  ClientListRow,
} from '@/types/models';

export const CLIENT_SORT_FIELDS = ['displayName', 'createdAt', 'status'] as const;
export type ClientSortField = (typeof CLIENT_SORT_FIELDS)[number];

export const listClients = (params: QueryParams, signal?: AbortSignal): Promise<Paged<ClientListRow>> =>
  apiList<ClientListRow>('/clients', {
    method: 'GET',
    query: params,
    ...(signal ? { signal } : {}),
  });

export const getClient = (id: string): Promise<ClientDetail> =>
  apiGet<ClientDetail>(`/clients/${id}`);

export const createClient = (body: unknown): Promise<ClientDetail> =>
  apiPost<ClientDetail>('/clients', body);

export const updateClient = (id: string, body: unknown): Promise<ClientDetail> =>
  apiPatch<ClientDetail>(`/clients/${id}`, body);

export const archiveClient = (id: string): Promise<ClientDetail> =>
  apiPost<ClientDetail>(`/clients/${id}/archive`);

export const restoreClient = (id: string): Promise<ClientDetail> =>
  apiPost<ClientDetail>(`/clients/${id}/restore`);

export const setClientAssignments = (id: string, staffIds: string[]): Promise<AssignmentResult> =>
  apiPut<AssignmentResult>(`/clients/${id}/assignments`, { staffIds });

export const pinClient = (id: string): Promise<void> => apiPost<void>(`/clients/${id}/pin`);

export const unpinClient = (id: string): Promise<void> => apiDelete<void>(`/clients/${id}/pin`);

export const revealAadhaar = (id: string): Promise<{ aadhaar: string }> =>
  apiPost<{ aadhaar: string }>(`/clients/${id}/aadhaar/reveal`);

export const listClientActivity = (
  id: string,
  params: QueryParams,
): Promise<Paged<AuditEntry>> =>
  apiList<AuditEntry>(`/clients/${id}/activity`, { method: 'GET', query: params });

export const exportClientsCsv = (params: QueryParams): Promise<void> =>
  downloadCsv('/clients/export', csvFilename('clients'), params);
