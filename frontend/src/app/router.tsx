import { lazy, Suspense } from 'react';

/**
 * One codebase, two shells. The active route table is chosen by an alias in
 * vite.config.ts — `@/app/routes.shell` resolves to website/routes.tsx in web
 * builds and desktop/routes.tsx in desktop builds. Because the alias is
 * fixed at config time, the bundler never even sees the other surface's
 * module: the web bundle contains zero staff route code and the desktop
 * bundle zero portal route code (D1 exit criteria).
 */
const ShellRoutes = lazy(async () => ({
  default: (await import('@/app/routes.shell')).ShellRoutes,
}));

export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <ShellRoutes />
    </Suspense>
  );
}
