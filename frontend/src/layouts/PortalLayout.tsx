import { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';

import { RouteAnnouncer, SkipLink } from '@/components/domain/SkipLink';
import { ErrorState } from '@/components/ui/error-state';
import { Spinner } from '@/components/ui/skeleton';
import { MobileDrawer } from '@/layouts/components/MobileDrawer';
import { PortalLinks, PortalNav } from '@/layouts/components/PortalNav';
import { useActiveClient } from '@/context/ActiveClientContext';

export function PortalLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { activeClientId, loading, error, retry } = useActiveClient();

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--fd-bg)]">
      <SkipLink />
      <PortalNav
        onOpenDrawer={() => {
          setDrawerOpen(true);
        }}
      />

      <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} title="FirmDesk portal">
        <nav aria-label="Portal" className="p-3">
          <PortalLinks
            onNavigate={() => {
              setDrawerOpen(false);
            }}
          />
        </nav>
      </MobileDrawer>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1080px] flex-1 px-4 py-6 text-md outline-none"
      >
        {error !== null && error !== undefined ? (
          <ErrorState error={error} onRetry={retry} title="We could not load your account" />
        ) : loading || activeClientId === null ? (
          <div className="flex justify-center py-16">
            <Spinner size={22} label="Loading your account" />
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="flex justify-center py-16">
                <Spinner size={22} label="Loading this screen" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        )}
      </main>

      <RouteAnnouncer />
    </div>
  );
}
