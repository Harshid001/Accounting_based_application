import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { Button } from '@/components/ui/button';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      data-print="hide"
      className="fixed bottom-4 left-1/2 z-[65] flex w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface-1)] p-3 shadow-[var(--fd-shadow-overlay)] sm:left-4 sm:translate-x-0"
    >
      <RefreshCw size={16} aria-hidden="true" className="shrink-0 text-[var(--fd-accent)]" />
      <p className="min-w-0 flex-1 text-base text-[var(--fd-text-primary)]">
        A new version of FirmDesk is ready.
      </p>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          setNeedRefresh(false);
        }}
      >
        Later
      </Button>
      <Button
        size="sm"
        variant="primary"
        onClick={() => {
          void updateServiceWorker(true);
        }}
      >
        Reload
      </Button>
    </div>
  );
}
