import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { RouteAnnouncer, SkipLink } from '@/components/domain/SkipLink';
import { ThemeToggle } from '@/components/domain/ThemeToggle';
import { Spinner } from '@/components/ui/skeleton';
import { JVLogo } from '@/components/brand/JVLogo';

export function DesktopAuthLayout() {
  const location = useLocation();

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--fd-bg)]">
      <SkipLink />

      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] px-5">
        <span className="flex items-center gap-2.5">
          <JVLogo size="sm" />
          <span className="text-base font-semibold tracking-tight text-[var(--fd-text-primary)]">
            JV Tax Consultancy
          </span>
        </span>
        <ThemeToggle />
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 items-center justify-center bg-[var(--fd-bg)] px-6 py-12 outline-none"
      >
        <div className="w-full max-w-md transition-[max-width] duration-200 has-[.fd-wide-auth]:max-w-4xl">
          <Suspense
            fallback={
              <div className="flex justify-center py-16">
                <Spinner size={22} label="Loading" />
              </div>
            }
          >
            <div key={location.pathname} className="page-transition">
              <Outlet />
            </div>
          </Suspense>
        </div>
      </main>

      <footer className="border-t border-[var(--fd-border-subtle)] px-6 py-5 text-center text-xs text-[var(--fd-text-tertiary)]">
        FirmDesk desktop is the secure operations workspace for practice staff and partners.
      </footer>

      <RouteAnnouncer />
    </div>
  );
}
