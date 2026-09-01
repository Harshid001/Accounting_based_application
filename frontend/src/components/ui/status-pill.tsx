import { cn } from '@/lib/cn';

export type StatusTone =
  | 'neutral'
  | 'progress'
  | 'waiting'
  | 'review'
  | 'done'
  | 'confirmed'
  | 'muted'
  | 'danger';

const DOT: Record<StatusTone, string> = {
  neutral: 'bg-[var(--fd-status-neutral)]',
  progress: 'bg-[var(--fd-status-progress)]',
  waiting: 'bg-[var(--fd-status-waiting)]',
  review: 'bg-[var(--fd-status-review)]',
  done: 'bg-[var(--fd-status-done)]',
  confirmed: 'bg-[var(--fd-status-confirmed)]',
  muted: 'bg-[var(--fd-status-muted)]',
  danger: 'bg-[var(--fd-status-danger)]',
};

const SURFACE: Record<StatusTone, string> = {
  neutral: 'bg-[var(--fd-status-neutral-bg)] text-[var(--fd-text-primary)]',
  progress: 'bg-[var(--fd-status-progress-bg)] text-[var(--fd-status-progress)]',
  waiting: 'bg-[var(--fd-status-waiting-bg)] text-[var(--fd-status-waiting)]',
  review: 'bg-[var(--fd-status-review-bg)] text-[var(--fd-status-review)]',
  done: 'bg-[var(--fd-status-done-bg)] text-[var(--fd-status-done)]',
  confirmed: 'bg-[var(--fd-status-confirmed-bg)] text-[var(--fd-status-confirmed)]',
  muted: 'bg-[var(--fd-status-muted-bg)] text-[var(--fd-text-tertiary)]',
  danger: 'bg-[var(--fd-status-danger-bg)] text-[var(--fd-status-danger)]',
};

export interface StatusPillProps {
  tone: StatusTone;
  label: string;
  dashed?: boolean;
  className?: string;
}

export function StatusPill({ tone, label, dashed = false, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        SURFACE[tone],
        dashed ? 'border border-dashed border-current' : '',
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT[tone])} aria-hidden="true" />
      {label}
    </span>
  );
}

export function StatusDot({ tone, className }: { tone: StatusTone; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', DOT[tone], className)}
    />
  );
}
