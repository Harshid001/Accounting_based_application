/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_SHELL?: 'web' | 'desktop';
  readonly VITE_DESKTOP_DOWNLOAD_URL?: string;
  readonly VITE_DESKTOP_UPDATE_URL?: string;
  readonly VITE_WEB_STAFF_ACCESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
