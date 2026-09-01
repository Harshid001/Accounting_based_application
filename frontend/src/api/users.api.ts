import { apiDelete, apiGet, apiList, apiPatch, apiPost, apiPut } from '@/api/client';
import type { Paged, QueryParams } from '@/types/api';
import type { Role } from '@/types/enums';
import type { AdminUser, StaffOption } from '@/types/models';

export const listUsers = (params: QueryParams): Promise<Paged<AdminUser>> =>
  apiList<AdminUser>('/users', { method: 'GET', query: params });

export const listStaffOptions = (): Promise<Paged<StaffOption>> =>
  apiList<StaffOption>('/users/staff', { method: 'GET', query: { page: 1, limit: 100 } });

export const getUser = (id: string): Promise<AdminUser> => apiGet<AdminUser>(`/users/${id}`);

export const updateUser = (
  id: string,
  body: { name?: string; phone?: string | null },
): Promise<AdminUser> => apiPatch<AdminUser>(`/users/${id}`, body);

export const setUserRole = (id: string, role: Role): Promise<AdminUser> =>
  apiPost<AdminUser>(`/users/${id}/role`, { role });

export const setUserLinkedClients = (id: string, clientIds: string[]): Promise<AdminUser> =>
  apiPut<AdminUser>(`/users/${id}/linked-clients`, { clientIds });

export const deactivateUser = (id: string): Promise<AdminUser> =>
  apiPost<AdminUser>(`/users/${id}/deactivate`);

export const activateUser = (id: string): Promise<AdminUser> =>
  apiPost<AdminUser>(`/users/${id}/activate`);

export const purgeUnlinkedAccounts = (olderThanDays: number): Promise<{ deleted: number }> =>
  apiDelete<{ deleted: number }>('/users/unlinked', { olderThanDays });
