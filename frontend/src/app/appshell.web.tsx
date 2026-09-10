import { lazy, Suspense } from 'react';

import { AppRoutes } from '@/app/router';

/**
 * Web shell: routes + the PWA update prompt. Only traced in web builds —
 * the `virtual:pwa-register` module (absent when the PWA plugin is
 * disabled in desktop builds) never reaches the desktop bundle.
 */
const WebUpdatePrompt = lazy(async () => ({
  default: (await import('@/app/WebUpdatePrompt')).UpdatePrompt,
}));

export function AppShell() {
  return (
    <>
      <AppRoutes />
      <Suspense fallback={null}>
        <WebUpdatePrompt />
      </Suspense>
    </>
  );
}
