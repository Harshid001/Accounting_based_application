import { apiBlob } from '@/api/client';
import type { QueryParams } from '@/types/api';

const triggerDownload = (href: string, filename: string | null): void => {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.rel = 'noopener';
  if (filename !== null) anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

export const downloadCsv = async (
  path: string,
  filename: string,
  query?: QueryParams,
): Promise<void> => {
  const blob = await apiBlob(path, query);
  const href = URL.createObjectURL(blob);
  try {
    triggerDownload(href, filename);
  } finally {
    window.setTimeout(() => {
      URL.revokeObjectURL(href);
    }, 2000);
  }
};

export const openPresignedUrl = (url: string): void => {
  triggerDownload(url, null);
};

export const csvFilename = (base: string): string => {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  return `firmdesk-${base}-${stamp}.csv`;
};
