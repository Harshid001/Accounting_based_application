import { apiDelete, apiGet, apiList, apiPatch, apiPost } from '@/api/client';
import { csvFilename, downloadCsv } from '@/lib/download';
import type { Paged, QueryParams } from '@/types/api';
import type {
  ComplianceDetail,
  ComplianceListRow,
  GeneratePreview,
  GenerateResult,
} from '@/types/models';
import type { ComplianceStatus } from '@/types/enums';

export const COMPLIANCE_SORT_FIELDS = ['dueDate', 'periodStart', 'createdAt'] as const;
export type ComplianceSortField = (typeof COMPLIANCE_SORT_FIELDS)[number];

export const listCompliance = (
  params: QueryParams,
  signal?: AbortSignal,
): Promise<Paged<ComplianceListRow>> =>
  apiList<ComplianceListRow>('/compliance', {
    method: 'GET',
    query: params,
    ...(signal ? { signal } : {}),
  });

export const getComplianceItem = (id: string): Promise<ComplianceDetail> =>
  apiGet<ComplianceDetail>(`/compliance/${id}`);

export const createComplianceItem = (body: unknown): Promise<ComplianceDetail> =>
  apiPost<ComplianceDetail>('/compliance', body);

export const updateComplianceItem = (id: string, body: unknown): Promise<ComplianceDetail> =>
  apiPatch<ComplianceDetail>(`/compliance/${id}`, body);

export interface StatusChangeInput {
  status: ComplianceStatus;
  filedDate?: string;
  notApplicableReason?: string;
}

export const changeComplianceStatus = (
  id: string,
  body: StatusChangeInput,
): Promise<ComplianceDetail> => apiPost<ComplianceDetail>(`/compliance/${id}/status`, body);

export const deleteComplianceItem = (id: string): Promise<void> =>
  apiDelete<void>(`/compliance/${id}`);

export interface GenerateInput {
  complianceTypeId: string;
  periodStart: string;
  periodEnd: string;
  clientIds?: string[];
}

export const previewGeneration = (body: GenerateInput): Promise<GeneratePreview> =>
  apiPost<GeneratePreview>('/compliance/generate/preview', body);

export const commitGeneration = (body: GenerateInput): Promise<GenerateResult> =>
  apiPost<GenerateResult>('/compliance/generate', body);

export const exportComplianceCsv = (params: QueryParams): Promise<void> =>
  downloadCsv('/compliance/export', csvFilename('compliance'), params);
