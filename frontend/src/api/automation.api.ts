import { apiBlob, apiGet, apiPost } from '@/api/client';
import { env } from '@/lib/env';
import type { AutomationRunView, AutomationSupportView } from '@/types/models';

export const getAutomationRun = (id: string): Promise<AutomationRunView> =>
  apiGet<AutomationRunView>(`/automation/runs/${id}`);

export const listAutomationRuns = (
  filters: { clientId?: string; status?: string; limit?: number } = {},
): Promise<AutomationRunView[]> => {
  const search = new URLSearchParams();
  if (filters.clientId !== undefined) search.set('clientId', filters.clientId);
  if (filters.status !== undefined) search.set('status', filters.status);
  if (filters.limit !== undefined) search.set('limit', String(filters.limit));
  const qs = search.toString();
  return apiGet<AutomationRunView[]>(`/automation/runs${qs.length > 0 ? `?${qs}` : ''}`);
};

export const getAutomationSupport = (): Promise<AutomationSupportView> =>
  apiGet<AutomationSupportView>('/automation/support');

export const startAutomationRun = (
  filingPreparationId: string,
  mode: 'recipe' | 'assisted' = 'recipe',
): Promise<AutomationRunView> =>
  apiPost<AutomationRunView>('/automation/runs', { filingPreparationId, mode });

export const abortAutomationRun = (id: string): Promise<void> =>
  apiPost<void>(`/automation/runs/${id}/abort`, {});

export const submitHandoff = (
  id: string,
  handoffId: string,
  value: string,
): Promise<void> =>
  apiPost<void>(`/automation/runs/${id}/handoff`, { handoffId, value });

export const downloadEvidencePack = async (id: string, filename: string): Promise<void> => {
  const blob = await apiBlob(`/automation/runs/${id}/evidence`);
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.rel = 'noopener';
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(href);
  }, 2000);
};

export const createSseUrl = (id: string): string => {
  const baseUrl = env.apiBaseUrl.replace(/\/$/, '');
  return `${baseUrl}/automation/runs/${id}/events`;
};
