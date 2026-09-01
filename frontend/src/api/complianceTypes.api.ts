import { apiDelete, apiGet, apiPatch, apiPost } from '@/api/client';
import type { QueryParams } from '@/types/api';
import type { ComplianceTypeView } from '@/types/models';

export const listComplianceTypes = (params?: QueryParams): Promise<ComplianceTypeView[]> =>
  apiGet<ComplianceTypeView[]>('/compliance-types', params);

export const getComplianceType = (id: string): Promise<ComplianceTypeView> =>
  apiGet<ComplianceTypeView>(`/compliance-types/${id}`);

export const createComplianceType = (body: unknown): Promise<ComplianceTypeView> =>
  apiPost<ComplianceTypeView>('/compliance-types', body);

export const updateComplianceType = (id: string, body: unknown): Promise<ComplianceTypeView> =>
  apiPatch<ComplianceTypeView>(`/compliance-types/${id}`, body);

export const deleteComplianceType = (id: string): Promise<void> =>
  apiDelete<void>(`/compliance-types/${id}`);
