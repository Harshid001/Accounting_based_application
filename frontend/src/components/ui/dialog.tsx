import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/icon-button';
import { useReturnFocus } from '@/hooks/useReturnFocus';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeLabel?: string;
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const;

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeLabel = 'Close',
}: DialogProps) {
  const { onCloseAutoFocus } = useReturnFocus(open);

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-[var(--fd-overlay)]" />
        <RadixDialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          className={cn(
            'fixed top-1/2 left-1/2 z-50 max-h-[85dvh] w-[calc(100vw-2rem)] -translate-x-1/2',
            '-translate-y-1/2 overflow-y-auto rounded-xl border border-[var(--fd-border)]',
            'bg-[var(--fd-surface-1)] p-5 shadow-[var(--fd-shadow-overlay)]',
            SIZES[size],
          )}
        >
          <div className="mb-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <RadixDialog.Title className="text-xl font-semibold text-[var(--fd-text-primary)]">
                {title}
              </RadixDialog.Title>
              {description === undefined ? (
                <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="mt-1 text-base text-[var(--fd-text-secondary)]">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close asChild>
              <IconButton label={closeLabel} icon={<X size={15} aria-hidden="true" />} size="sm" />
            </RadixDialog.Close>
          </div>

          <div className="min-w-0">{children}</div>

          {footer === undefined ? null : (
            <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export const DialogClose = RadixDialog.Close;
