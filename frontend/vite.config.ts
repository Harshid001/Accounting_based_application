/*
 * Verified against the installed vite-plugin-pwa@1.3.0 before this file was written.
 * 1. `registerType: 'prompt'` is a published option; the prompt flow is driven from the app
 *    through `virtual:pwa-register/react`'s `useRegisterSW`, so `injectRegister` is null and
 *    the plugin injects no registration script of its own.
 * 2. `workbox.navigateFallbackDenylist` is `Array<RegExp>` (workbox-build GenerateSWOptions);
 *    `/^\/api\//` keeps every API path off the SPA navigation fallback.
 * 3. `workbox-build@^7.4.1` and `workbox-window@^7.4.1` are declared peers and are installed
 *    explicitly rather than relied upon transitively.
 * 4. `runtimeCaching` is deliberately absent: the service worker precaches the shell only and
 *    never stores an API response.
 */
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const DEFAULT_API_ORIGIN = 'http://localhost:4000';

const proxyTarget = (apiBaseUrl: string | undefined): string => {
  if (apiBaseUrl === undefined || apiBaseUrl.length === 0) return DEFAULT_API_ORIGIN;
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return DEFAULT_API_ORIGIN;
  }
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const appName = env.VITE_APP_NAME ?? 'FirmDesk';
  const target = proxyTarget(env.VITE_API_BASE_URL);

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: null,
        includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png'],
        manifest: {
          name: appName,
          short_name: appName,
          description: 'Compliance, documents and client work for one accounting practice.',
          lang: 'en-IN',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#0B0F17',
          theme_color: '#0B0F17',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
          clientsClaim: false,
          skipWaiting: false,
        },
        devOptions: { enabled: false },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target, changeOrigin: false, secure: false },
      },
    },
    preview: { port: 4173 },
    build: {
      target: 'es2022',
      sourcemap: true,
      chunkSizeWarningLimit: 900,
    },
  };
});
