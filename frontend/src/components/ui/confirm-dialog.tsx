import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  typedConfirmation?: string;
  typedHint?: string;
  pending?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Keep it',
  destructive = false,
  typedConfirmation,
  typedHint,
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const [wasOpen, setWasOpen] = useState(open);

  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setTyped('');
  }

  const needsTyping = typeof typedConfirmation === 'string' && typedConfirmation.length > 0;
  const canConfirm = !needsTyping || typed === typedConfirmation;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            disabled={!canConfirm}
            loading={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-base text-[var(--fd-text-secondary)]">{body}</p>

      {needsTyping ? (
        <div className="mt-4">
          <FormField
            label={typedHint ?? `Type ${typedConfirmation} to confirm`}
            required
            helper="This has to match exactly, including capitals."
          >
            {({ inputId, describedBy }) => (
              <Input
                id={inputId}
                aria-describedby={describedBy}
                value={typed}
                autoComplete="off"
                onChange={(event) => {
                  setTyped(event.target.value);
                }}
              />
            )}
          </FormField>
        </div>
      ) : null}
    </Dialog>
  );
}
