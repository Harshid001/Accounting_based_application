import { Eye } from 'lucide-react';
import { useState } from 'react';

import { revealOwnAadhaar } from '@/api/portal.api';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { InlineError } from '@/components/ui/error-state';
import { Spinner } from '@/components/ui/skeleton';
import { normaliseError } from '@/lib/errors';

export function OwnAadhaar({ present }: { present: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!present) {
    return <span className="text-md text-[var(--fd-text-tertiary)]">Not on file</span>;
  }

  const close = (): void => {
    setOpen(false);
    setValue(null);
    setError(null);
  };

  const reveal = (): void => {
    setOpen(true);
    setBusy(true);
    setError(null);
    void revealOwnAadhaar()
      .then((result) => {
        setValue(result.aadhaar);
      })
      .catch((cause: unknown) => {
        setError(normaliseError(cause).message);
      })
      .finally(() => {
        setBusy(false);
      });
  };

  const grouped = value === null ? null : value.replace(/(\d{4})(?=\d)/g, '$1 ');

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        iconLeft={<Eye size={14} aria-hidden="true" />}
        onClick={reveal}
      >
        Show my Aadhaar
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        size="sm"
        title="Your Aadhaar number"
        description="Shown once. Closing this clears it from the screen."
        footer={
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        }
      >
        {busy ? (
          <div className="flex justify-center py-6">
            <Spinner size={20} label="Decrypting" />
          </div>
        ) : error !== null ? (
          <InlineError message={error} />
        ) : (
          <p className="numeric rounded-md border border-[var(--fd-border)] bg-[var(--fd-surface-2)] px-4 py-3 text-center text-2xl tracking-widest text-[var(--fd-text-primary)]">
            {grouped}
          </p>
        )}
        <p className="mt-3 text-xs text-[var(--fd-text-tertiary)]">
          Your firm records every time this is shown, including when you do it yourself.
        </p>
      </Dialog>
    </>
  );
}
