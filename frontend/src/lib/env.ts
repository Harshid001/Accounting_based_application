export interface AppEnv {
  apiBaseUrl: string;
  authBaseUrl: string;
  appName: string;
  appShell: AppShell;
  desktopDownloadUrl: string;
  desktopUpdateUrl: string;
  webStaffAccess: boolean;
}

export type AppShell = 'web' | 'desktop';

const API_SUFFIX = '/api/v1';

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const deriveAuthBaseUrl = (apiBaseUrl: string): string => {
  const trimmed = stripTrailingSlash(apiBaseUrl);
  const withoutSuffix = trimmed.endsWith(API_SUFFIX)
    ? trimmed.slice(0, -API_SUFFIX.length)
    : trimmed;
  if (withoutSuffix.length > 0) return withoutSuffix;
  // Some embedded webviews (including Tauri on some setups) expose a null
  // or "null" origin; never build the auth base from that.
  const origin = window.location.origin;
  return origin === 'null' || origin.length === 0 ? 'http://localhost:4000' : origin;
};

const readEnv = (): AppEnv => {
  const missing: string[] = [];

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (apiBaseUrl === undefined || apiBaseUrl.length === 0) missing.push('VITE_API_BASE_URL');

  const appName = import.meta.env.VITE_APP_NAME?.trim();
  if (appName === undefined || appName.length === 0) missing.push('VITE_APP_NAME');
  const appShell = import.meta.env.VITE_APP_SHELL?.trim().toLowerCase();
  if (appShell !== undefined && appShell !== '' && appShell !== 'web' && appShell !== 'desktop') {
    missing.push('VITE_APP_SHELL (must be web or desktop)');
  }

  if (missing.length > 0 || apiBaseUrl === undefined || appName === undefined) {
    throw new Error(
      `FirmDesk cannot start: ${missing.join(', ')} ${
        missing.length === 1 ? 'is' : 'are'
      } missing. Copy .env.example to .env and fill in the values, then restart the dev server.`,
    );
  }

  return {
    apiBaseUrl: stripTrailingSlash(apiBaseUrl),
    authBaseUrl: deriveAuthBaseUrl(apiBaseUrl),
    appName,
    appShell: appShell === 'desktop' ? 'desktop' : 'web',
    desktopDownloadUrl: import.meta.env.VITE_DESKTOP_DOWNLOAD_URL?.trim() || '/desktop-download',
    desktopUpdateUrl: import.meta.env.VITE_DESKTOP_UPDATE_URL?.trim() || '',
    webStaffAccess: import.meta.env.VITE_WEB_STAFF_ACCESS?.trim().toLowerCase() === 'true',
  };
};

export const env: AppEnv = readEnv();
