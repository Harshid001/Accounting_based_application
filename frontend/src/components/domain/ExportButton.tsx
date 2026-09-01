import { Download } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/context/ToastContext';

export interface ExportButtonProps {
  onExport: () => Promise<void>;
  label?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function ExportButton({
  onExport,
  label = 'Export CSV',
  disabled = false,
  disabledReason,
}: ExportButtonProps) {
  const { success, errorToast } = useToast();
  const [busy, setBusy] = useState(false);

  const run = (): void => {
    if (busy) return;
    setBusy(true);
    void onExport()
      .then(() => {
        success('Export started', 'Your CSV is downloading now.');
      })
      .catch((error: unknown) => {
        errorToast(error, 'That export did not run');
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={busy}
      loadingLabel="Preparing your export"
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      iconLeft={<Download size={14} aria-hidden="true" />}
      onClick={run}
    >
      {label}
    </Button>
  );
}
