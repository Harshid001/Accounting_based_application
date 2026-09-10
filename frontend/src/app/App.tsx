import { lazy, Suspense } from 'react';

import { BrowserRouter } from 'react-router-dom';

import { Providers } from '@/app/providers';
import { RootErrorBoundary } from '@/app/RootErrorBoundary';

/**
 * App frame shared by both shells: error boundary + router + providers.
 * The shell-specific chrome (route tables AND the web-only PWA prompt)
 * lives in `@/app/appshell` — an alias vite.config.ts points at
 * appshell.web.tsx or appshell.desktop.tsx per build, so neither bundle
 * traces the other surface's code.
 */
const AppShell = lazy(async () => ({ default: (await import('@/app/appshell')).AppShell }));

export function App() {
  return (
    <RootErrorBoundary>
      <BrowserRouter>
        <Providers>
          <Suspense fallback={null}>
            <AppShell />
          </Suspense>
        </Providers>
      </BrowserRouter>
    </RootErrorBoundary>
  );
}
