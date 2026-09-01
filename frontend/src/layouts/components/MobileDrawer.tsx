import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

import { useReturnFocus } from '@/hooks/useReturnFocus';

export interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

export function MobileDrawer({ open, onOpenChange, title, children }: MobileDrawerProps) {
  const { onCloseAutoFocus } = useReturnFocus(open);

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-[var(--fd-overlay)]" />
        <RadixDialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          className="fixed inset-y-0 left-0 z-50 w-60 max-w-[85vw] overflow-y-auto border-r border-[var(--fd-border)] bg-[var(--fd-surface-1)] shadow-[var(--fd-shadow-overlay)] outline-none"
        >
          <RadixDialog.Title className="sr-only">{title}</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">
            Navigate to another part of {title}.
          </RadixDialog.Description>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
