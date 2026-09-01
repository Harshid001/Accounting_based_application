import { apiDelete, apiGet, apiPatch, apiPost } from '@/api/client';
import type { ClientServiceView } from '@/types/models';

export const listClientServices = (clientId: string): Promise<ClientServiceView[]> =>
  apiGet<ClientServiceView[]>(`/clients/${clientId}/services`);

export const createClientService = (
  clientId: string,
  body: unknown,
): Promise<ClientServiceView> => apiPost<ClientServiceView>(`/clients/${clientId}/services`, body);

export const updateClientService = (id: string, body: unknown): Promise<ClientServiceView> =>
  apiPatch<ClientServiceView>(`/client-services/${id}`, body);

export const deleteClientService = (id: string): Promise<void> =>
  apiDelete<void>(`/client-services/${id}`);
