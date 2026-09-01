import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';

import { RouteAnnouncer, SkipLink } from '@/components/domain/SkipLink';
import { ThemeToggle } from '@/components/domain/ThemeToggle';
import { Spinner } from '@/components/ui/skeleton';

export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--fd-bg)]">
      <SkipLink />

      <header className="flex h-14 shrink-0 items-center justify-between px-4">
        <span className="text-lg font-semibold text-[var(--fd-text-primary)]">FirmDesk</span>
        <ThemeToggle />
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 outline-none sm:items-center sm:pt-0"
      >
        <div className="w-full max-w-md">
          <Suspense
            fallback={
              <div className="flex justify-center py-16">
                <Spinner size={22} label="Loading" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </main>

      <footer className="px-4 pb-6 text-center text-xs text-[var(--fd-text-tertiary)]">
        FirmDesk is the internal operations system for one accounting practice.
      </footer>

      <RouteAnnouncer />
    </div>
  );
}
