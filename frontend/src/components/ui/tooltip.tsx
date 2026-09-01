import * as Radix from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Radix.Provider delayDuration={300} skipDelayDuration={200}>
      {children}
    </Radix.Provider>
  );
}

export interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  return (
    <Radix.Root>
      <Radix.Trigger asChild>{children}</Radix.Trigger>
      <Radix.Portal>
        <Radix.Content
          side={side}
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            'z-50 max-w-64 rounded-md border border-[var(--fd-border)] bg-[var(--fd-surface-1)]',
            'px-2 py-1 text-xs text-[var(--fd-text-primary)] shadow-[var(--fd-shadow-overlay)]',
            className,
          )}
        >
          {content}
          <Radix.Arrow className="fill-[var(--fd-border)]" />
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  );
}

export function DisabledHint({
  reason,
  children,
}: {
  reason: string | null;
  children: ReactNode;
}) {
  if (reason === null) return <>{children}</>;
  return (
    <Tooltip content={reason}>
      <span className="inline-flex">{children}</span>
    </Tooltip>
  );
}
