import { apiList, apiPatch, apiPost } from '@/api/client';
import type { Paged, QueryParams } from '@/types/api';
import type { DocumentType } from '@/types/enums';
import type { DocumentRequestView } from '@/types/models';

export interface DocumentRequestInput {
  title: string;
  description?: string | null;
  documentType: DocumentType;
  dueDate?: string | null;
  complianceItemId?: string | null;
}

export const listDocumentRequests = (
  params: QueryParams,
  signal?: AbortSignal,
): Promise<Paged<DocumentRequestView>> =>
  apiList<DocumentRequestView>('/document-requests', {
    method: 'GET',
    query: params,
    ...(signal ? { signal } : {}),
  });

export const createDocumentRequest = (
  clientId: string,
  input: DocumentRequestInput,
): Promise<DocumentRequestView[]> =>
  apiPost<DocumentRequestView[]>('/document-requests', { clientId, ...input });

export const createDocumentRequestBatch = (
  clientId: string,
  items: DocumentRequestInput[],
): Promise<DocumentRequestView[]> =>
  apiPost<DocumentRequestView[]>('/document-requests', { clientId, items });

export const updateDocumentRequest = (
  id: string,
  input: Partial<DocumentRequestInput>,
): Promise<DocumentRequestView> => apiPatch<DocumentRequestView>(`/document-requests/${id}`, input);

export const cancelDocumentRequest = (id: string): Promise<DocumentRequestView> =>
  apiPost<DocumentRequestView>(`/document-requests/${id}/cancel`);

export const remindDocumentRequest = (id: string): Promise<{ sent: number }> =>
  apiPost<{ sent: number }>(`/document-requests/${id}/remind`);
