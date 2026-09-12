import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  // The shell matrix (spec §11): `npm run test:desktop` sets VITE_APP_SHELL
  // before invoking vitest; the default remains the web shell.
  const appShell = process.env.VITE_APP_SHELL === 'desktop' ? 'desktop' : 'web';
  void mode;
  return {
    resolve: {
      alias: [
        // Shell aliases (must precede '@': array aliases match in order).
        {
          find: /^@\/app\/routes\.shell$/,
          replacement: fileURLToPath(
            new URL(
              `./src/${appShell === 'desktop' ? 'desktop' : 'website'}/routes.tsx`,
              import.meta.url,
            ),
          ),
        },
        {
          find: /^@\/app\/appshell$/,
          replacement: fileURLToPath(
            new URL(
              `./src/app/appshell.${appShell === 'desktop' ? 'desktop' : 'web'}.tsx`,
              import.meta.url,
            ),
          ),
        },
        { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
        { find: /^pdfjs-dist$/, replacement: 'pdfjs-dist/legacy/build/pdf.mjs' },
      ],
    },
    test: {
      environment: 'jsdom',
      globals: true,
      env: {
        VITE_API_BASE_URL: 'http://localhost:4000/api/v1',
        VITE_APP_NAME: 'FirmDesk',
        VITE_APP_SHELL: appShell,
      },
      css: false,
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.test.{ts,tsx}'],
      restoreMocks: true,
      clearMocks: true,
      fileParallelism: true,
      maxWorkers: 4,
      testTimeout: 15_000,
    },
  };
});
