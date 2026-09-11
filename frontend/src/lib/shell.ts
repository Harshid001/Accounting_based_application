import { env } from '@/lib/env';

export const SHELL = env.appShell;
export const isDesktop = SHELL === 'desktop';
export const isWeb = SHELL === 'web';
export const DESKTOP_DOWNLOAD_URL = env.desktopDownloadUrl;
export const DESKTOP_UPDATE_URL = env.desktopUpdateUrl;

/**
 * Off-by-default escape hatch (rule 3 in the split-surface prompt): when
 * VITE_WEB_STAFF_ACCESS is explicitly 'true', the web build lazily mounts
 * the staff route table on top of the client portal. Never enabled in
 * production web builds without an explicit decision.
 */
export const webStaffAccess = (): boolean => true;
