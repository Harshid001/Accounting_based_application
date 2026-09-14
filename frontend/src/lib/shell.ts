import { env } from '@/lib/env';

const isTauriRuntime =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window ||
    window.location.hostname === 'tauri.localhost' ||
    window.location.protocol === 'tauri:');

export const SHELL = isTauriRuntime ? 'desktop' : env.appShell;
export const isDesktop = SHELL === 'desktop' || isTauriRuntime;
export const isWeb = !isDesktop;
export const DESKTOP_DOWNLOAD_URL = env.desktopDownloadUrl;
export const DESKTOP_UPDATE_URL = env.desktopUpdateUrl;

