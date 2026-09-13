import { env } from '@/lib/env';

export const SHELL = env.appShell;
export const isDesktop = SHELL === 'desktop';
export const isWeb = SHELL === 'web';
export const DESKTOP_DOWNLOAD_URL = env.desktopDownloadUrl;
export const DESKTOP_UPDATE_URL = env.desktopUpdateUrl;
