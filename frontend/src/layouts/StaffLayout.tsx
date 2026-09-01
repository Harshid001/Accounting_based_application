import { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';

import { CommandPalette } from '@/components/domain/CommandPalette';
import { RouteAnnouncer, SkipLink } from '@/components/domain/SkipLink';
import { Spinner } from '@/components/ui/skeleton';
import { MobileDrawer } from '@/layouts/components/MobileDrawer';
import { Sidebar } from '@/layouts/components/Sidebar';
import { Topbar } from '@/layouts/components/Topbar';
import { SIDEBAR_STORAGE_KEY } from '@/lib/constants';
import { useHotkey } from '@/hooks/useHotkey';

const readCollapsed = (): boolean => {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'collapsed';
  } catch {
    return false;
  }
};

export function StaffLayout() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useHotkey({ key: 'k', meta: true, allowInInput: true }, () => {
    setPaletteOpen(true);
  });

  const toggleSidebar = (): void => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? 'collapsed' : 'open');
      } catch {
        return next;
      }
      return next;
    });
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--fd-bg)]">
      <SkipLink />

      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      </div>

      <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} title="FirmDesk">
        <Sidebar
          collapsed={false}
          variant="drawer"
          onToggle={toggleSidebar}
          onNavigate={() => {
            setDrawerOpen(false);
          }}
        />
      </MobileDrawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenDrawer={() => {
            setDrawerOpen(true);
          }}
          onOpenPalette={() => {
            setPaletteOpen(true);
          }}
        />

        <main
          id="main-content"
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-5 outline-none sm:px-6"
        >
          <div className="mx-auto w-full max-w-[1440px]">
            <Suspense
              fallback={
                <div className="flex justify-center py-16">
                  <Spinner size={22} label="Loading this screen" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <RouteAnnouncer />
    </div>
  );
}
