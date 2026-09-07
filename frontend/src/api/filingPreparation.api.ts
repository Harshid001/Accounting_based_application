import { apiBlob, apiGet, apiPost } from '@/api/client';
import type { FilingPreparationView } from '@/types/models';

export const getFilingPreparation = (filingId: string): Promise<FilingPreparationView> =>
  apiGet<FilingPreparationView>(`/filing-preparations/${filingId}`);

export const prepareFilingReturn = (filingId: string): Promise<FilingPreparationView> =>
  apiPost<FilingPreparationView>(`/filing-preparations/${filingId}/prepare`, {});

export const updateGuideStep = (
  filingId: string,
  stepIndex: number,
  done: boolean,
): Promise<FilingPreparationView> =>
  apiPost<FilingPreparationView>(`/filing-preparations/${filingId}/guide-step`, {
    stepIndex,
    done,
  });

export const lockFilingPreparation = (filingId: string): Promise<FilingPreparationView> =>
  apiPost<FilingPreparationView>(`/filing-preparations/${filingId}/lock`, {});

export const downloadPreparationPayload = async (
  filingId: string,
  filename: string,
): Promise<void> => {
  const blob = await apiBlob(`/filing-preparations/${filingId}/download`);
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

