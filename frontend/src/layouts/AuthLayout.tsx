import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { RouteAnnouncer, SkipLink } from '@/components/domain/SkipLink';
import { ThemeToggle } from '@/components/domain/ThemeToggle';
import { Spinner } from '@/components/ui/skeleton';
import { JVLogo } from '@/components/brand/JVLogo';

export function AuthLayout() {
  const location = useLocation();

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--fd-bg)]">
      <SkipLink />

      <header className="flex h-14 shrink-0 items-center justify-between px-4">
        <span className="flex items-center gap-2.5">
          <JVLogo size="sm" />
          <span className="text-base font-semibold text-[var(--fd-text-primary)] tracking-tight">JV Tax Consultancy</span>
        </span>
        <ThemeToggle />
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 outline-none sm:items-center sm:pt-0"
      >
        <div className="w-full max-w-md has-[.fd-wide-auth]:max-w-4xl transition-[max-width] duration-200">
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

      <footer className="px-4 pb-6 text-center text-xs text-[var(--fd-text-tertiary)]">
        JV Tax Consultancy — Chartered Accountants practice management portal.
      </footer>

      <RouteAnnouncer />
    </div>
  );
}
