import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { CommandPalette } from '@/components/domain/CommandPalette';
import { RouteAnnouncer, SkipLink } from '@/components/domain/SkipLink';
import { Spinner } from '@/components/ui/skeleton';
import { MobileDrawer } from '@/layouts/components/MobileDrawer';
import { Sidebar } from '@/layouts/components/Sidebar';
import { Topbar } from '@/layouts/components/Topbar';
import { AiChatSidebar } from '@/components/domain/AiChatDropdown';
import { SIDEBAR_STORAGE_KEY } from '@/lib/constants';
import { useHotkey } from '@/hooks/useHotkey';
import { useFeatureGuide } from '@/context/FeatureGuideContext';
import type { AttachedImageData } from '@/context/AiChatContext';

const readCollapsed = (): boolean => {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'collapsed';
  } catch {
    return false;
  }
};

export function StaffLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteInitialImage, setPaletteInitialImage] = useState<AttachedImageData | null>(null);
  const { openGuide, isGuideOpen, closeGuide } = useFeatureGuide();

  useHotkey({ key: 'k', meta: true, allowInInput: true }, () => {
    setPaletteOpen(true);
  });

  useHotkey({ key: '?', shift: true, allowInInput: false }, () => {
    if (isGuideOpen) {
      closeGuide();
    } else {
      openGuide();
    }
  });

  // Global paste handler: if user pastes an image anywhere on screen while not typing in an input,
  // automatically open the search command palette with the image attached
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (
        activeTag === 'INPUT' ||
        activeTag === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                setPaletteInitialImage({
                  dataUrl: reader.result,
                  name: file.name || 'Pasted screenshot',
                  mimeType: file.type,
                });
                setPaletteOpen(true);
              }
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

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
          onOpenPalette={(img) => {
            if (img) setPaletteInitialImage(img);
            setPaletteOpen(true);
          }}
        />

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <main
            id="main-content"
            tabIndex={-1}
            className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-5 outline-none sm:px-6 transition-all duration-300 ease-in-out"
          >
            <div className="mx-auto w-full max-w-[1440px]">
              <Suspense
                fallback={
                  <div className="flex justify-center py-16">
                    <Spinner size={22} label="Loading this screen" />
                  </div>
                }
              >
                <div key={location.pathname} className="page-transition">
                  <Outlet />
                </div>
              </Suspense>
            </div>
          </main>

          <AiChatSidebar />
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={(next) => {
          setPaletteOpen(next);
          if (!next) setPaletteInitialImage(null);
        }}
        initialImage={paletteInitialImage}
        onClearInitialImage={() => setPaletteInitialImage(null)}
      />
      <RouteAnnouncer />
    </div>
  );
}
