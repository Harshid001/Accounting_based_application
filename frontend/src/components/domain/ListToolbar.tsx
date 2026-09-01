import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

export interface ListToolbarProps {
  total: number | null;
  noun: string;
  children?: ReactNode;
  className?: string;
}

export function ListToolbar({ total, noun, children, className }: ListToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label={`${noun} actions`}
      data-print="hide"
      className={cn('mb-3 flex flex-wrap items-center justify-between gap-2', className)}
    >
      <p className="numeric text-xs text-[var(--fd-text-tertiary)]" aria-live="polite">
        {total === null ? ' ' : `${formatNumber(total)} ${total === 1 ? noun : `${noun}s`}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
