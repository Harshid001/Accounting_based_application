export interface AppEnv {
  apiBaseUrl: string;
  authBaseUrl: string;
  appName: string;
}

const API_SUFFIX = '/api/v1';

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const deriveAuthBaseUrl = (apiBaseUrl: string): string => {
  const trimmed = stripTrailingSlash(apiBaseUrl);
  const withoutSuffix = trimmed.endsWith(API_SUFFIX)
    ? trimmed.slice(0, -API_SUFFIX.length)
    : trimmed;
  return withoutSuffix.length > 0 ? withoutSuffix : window.location.origin;
};

const readEnv = (): AppEnv => {
  const missing: string[] = [];

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (apiBaseUrl === undefined || apiBaseUrl.length === 0) missing.push('VITE_API_BASE_URL');

  const appName = import.meta.env.VITE_APP_NAME?.trim();
  if (appName === undefined || appName.length === 0) missing.push('VITE_APP_NAME');

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
  };
};

export const env: AppEnv = readEnv();
