import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/icon-button';
import { useReturnFocus } from '@/hooks/useReturnFocus';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: 'right' | 'left';
  className?: string;
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = 'right',
  className,
}: SheetProps) {
  const { onCloseAutoFocus } = useReturnFocus(open);

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-[var(--fd-overlay)]" />
        <RadixDialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          className={cn(
            'fixed z-50 flex flex-col border-[var(--fd-border)] bg-[var(--fd-surface-1)]',
            'shadow-[var(--fd-shadow-overlay)]',
            'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-xl border-t',
            side === 'right'
              ? 'sm:inset-y-0 sm:right-0 sm:left-auto sm:w-full sm:max-w-md sm:rounded-none sm:rounded-l-xl sm:border-t-0 sm:border-l'
              : 'sm:inset-y-0 sm:right-auto sm:left-0 sm:w-full sm:max-w-md sm:rounded-none sm:rounded-r-xl sm:border-t-0 sm:border-r',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-[var(--fd-border-subtle)] p-4">
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
              <IconButton label="Close" icon={<X size={15} aria-hidden="true" />} size="sm" />
            </RadixDialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>

          {footer === undefined ? null : (
            <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--fd-border-subtle)] p-4">
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
