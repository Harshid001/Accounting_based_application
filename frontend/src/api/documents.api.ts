import { apiDelete, apiGet, apiList, apiPatch, apiPost } from '@/api/client';
import type { Paged, QueryParams } from '@/types/api';
import type { DocumentType } from '@/types/enums';
import type {
  DocumentDetail,
  DocumentListRow,
  DownloadTicket,
  PresignedUpload,
} from '@/types/models';

export const DOCUMENT_SORT_FIELDS = ['createdAt', 'title', 'documentType'] as const;
export type DocumentSortField = (typeof DOCUMENT_SORT_FIELDS)[number];

export interface PresignInput {
  clientId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export const presignUpload = (input: PresignInput): Promise<PresignedUpload> =>
  apiPost<PresignedUpload>('/documents/presign-upload', input);

export interface FinaliseInput {
  clientId: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  title: string;
  documentType: DocumentType;
  customTypeLabel?: string | null;
  complianceItemId?: string | null;
  documentRequestId?: string | null;
}

export const finaliseUpload = (input: FinaliseInput): Promise<DocumentDetail> =>
  apiPost<DocumentDetail>('/documents', input);

export interface VersionInput {
  storageKey: string;
  filename: string;
  mimeType: string;
}

export const addDocumentVersion = (id: string, input: VersionInput): Promise<DocumentDetail> =>
  apiPost<DocumentDetail>(`/documents/${id}/versions`, input);

export const listDocuments = (
  params: QueryParams,
  signal?: AbortSignal,
): Promise<Paged<DocumentListRow>> =>
  apiList<DocumentListRow>('/documents', {
    method: 'GET',
    query: params,
    ...(signal ? { signal } : {}),
  });

export const getDocument = (id: string): Promise<DocumentDetail> =>
  apiGet<DocumentDetail>(`/documents/${id}`);

export const requestDownload = (id: string, version?: number): Promise<DownloadTicket> =>
  apiGet<DownloadTicket>(
    `/documents/${id}/download`,
    version === undefined ? undefined : { version },
  );

export const updateDocument = (id: string, body: unknown): Promise<DocumentDetail> =>
  apiPatch<DocumentDetail>(`/documents/${id}`, body);

export const archiveDocument = (id: string): Promise<DocumentListRow> =>
  apiPost<DocumentListRow>(`/documents/${id}/archive`);

export const restoreDocument = (id: string): Promise<DocumentListRow> =>
  apiPost<DocumentListRow>(`/documents/${id}/restore`);

export const hardDeleteDocument = (id: string, confirm: string): Promise<void> =>
  apiDelete<void>(`/documents/${id}`, { confirm });
