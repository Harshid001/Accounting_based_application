import type { ReactNode } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'accent' | 'danger' | 'waiting' | 'done' | 'muted';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--fd-surface-3)] text-[var(--fd-text-secondary)]',
  accent: 'bg-[var(--fd-accent-subtle-bg)] text-[var(--fd-accent)]',
  danger: 'bg-[var(--fd-status-danger-bg)] text-[var(--fd-status-danger)]',
  waiting: 'bg-[var(--fd-status-waiting-bg)] text-[var(--fd-status-waiting)]',
  done: 'bg-[var(--fd-status-done-bg)] text-[var(--fd-status-done)]',
  muted: 'bg-[var(--fd-status-muted-bg)] text-[var(--fd-text-tertiary)]',
};

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

export function Badge({ children, tone = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export interface ChipProps {
  label: string;
  value?: string;
  onRemove?: () => void;
  removeLabel?: string;
  tone?: BadgeTone;
  className?: string;
}

export function Chip({ label, value, onRemove, removeLabel, tone = 'neutral', className }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border border-[var(--fd-border-subtle)] px-2 py-1 text-xs',
        TONES[tone],
        className,
      )}
    >
      <span className="text-[var(--fd-text-tertiary)]">{label}</span>
      {value === undefined ? null : (
        <span className="font-medium text-[var(--fd-text-primary)]">{value}</span>
      )}
      {onRemove === undefined ? null : (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? `Remove ${label} filter`}
          className="rounded-sm text-[var(--fd-text-tertiary)] hover:text-[var(--fd-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--fd-focus-ring)]"
        >
          <X size={12} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
