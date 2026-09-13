import { defineConfig, devices } from '@playwright/test';

const isCi = process.env.CI !== undefined;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: isCi ? [['github'], ['list']] : 'list',
  use: { trace: 'retain-on-failure', channel: process.env.E2E_BROWSER_CHANNEL },
  webServer: [
    {
      command: 'npm run preview:web',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !isCi,
      timeout: 60_000,
    },
    {
      command: 'npm run preview:desktop',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: !isCi,
      timeout: 60_000,
    },
  ],
  projects: [
    {
      name: 'web',
      testMatch: /web-shell\.e2e\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4173' },
    },
    {
      name: 'desktop',
      testMatch: /desktop-shell\.e2e\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4174' },
    },
  ],
});
