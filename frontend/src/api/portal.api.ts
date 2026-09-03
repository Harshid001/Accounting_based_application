import { apiGet, apiList, apiPatch, apiPost } from '@/api/client';
import type { Paged, QueryParams } from '@/types/api';
import type {
  PortalActivityEntry,
  PortalClientOption,
  PortalClientProfile,
  PortalComplianceRow,
  PortalDocumentRequestView,
  PortalOnboardingPayload,
  PortalOnboardingResult,
  PortalOverview,
  PortalTaskRow,
} from '@/types/models';

export const listPortalClients = (): Promise<PortalClientOption[]> =>
  apiGet<PortalClientOption[]>('/portal/clients');

export const fetchPortalOverview = (): Promise<PortalOverview> =>
  apiGet<PortalOverview>('/portal/overview');

export const listPortalCompliance = (params: QueryParams): Promise<Paged<PortalComplianceRow>> =>
  apiList<PortalComplianceRow>('/portal/compliance', { method: 'GET', query: params });

export const listPortalTasks = (params: QueryParams): Promise<Paged<PortalTaskRow>> =>
  apiList<PortalTaskRow>('/portal/tasks', { method: 'GET', query: params });

export const listPortalRequests = (
  params: QueryParams,
): Promise<Paged<PortalDocumentRequestView>> =>
  apiList<PortalDocumentRequestView>('/portal/requests', { method: 'GET', query: params });

export const listPortalActivity = (params: QueryParams): Promise<Paged<PortalActivityEntry>> =>
  apiList<PortalActivityEntry>('/portal/activity', { method: 'GET', query: params });

export const fetchPortalProfile = (): Promise<PortalClientProfile> =>
  apiGet<PortalClientProfile>('/portal/profile');

export const updatePortalProfile = (body: unknown): Promise<PortalClientProfile> =>
  apiPatch<PortalClientProfile>('/portal/profile', body);

export const submitPortalOnboarding = (
  body: PortalOnboardingPayload,
): Promise<PortalOnboardingResult> =>
  apiPost<PortalOnboardingResult>('/portal/onboarding', body);

export const revealOwnAadhaar = (): Promise<{ aadhaar: string }> =>
  apiGet<{ aadhaar: string }>('/portal/aadhaar');

