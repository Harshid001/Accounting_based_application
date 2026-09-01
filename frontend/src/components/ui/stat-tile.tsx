import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';

export interface StatTileProps {
  label: string;
  value: number | string | null;
  hint?: string;
  to?: string;
  tone?: 'default' | 'danger' | 'waiting';
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
}

const TONES = {
  default: 'text-[var(--fd-text-primary)]',
  danger: 'text-[var(--fd-status-danger)]',
  waiting: 'text-[var(--fd-status-waiting)]',
} as const;

export function StatTile({
  label,
  value,
  hint,
  to,
  tone = 'default',
  loading = false,
  icon,
  className,
}: StatTileProps) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[var(--fd-text-secondary)]">{label}</span>
        {icon === undefined ? null : (
          <span className="text-[var(--fd-text-tertiary)]">{icon}</span>
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-9 w-16" />
      ) : (
        <p className={cn('numeric mt-1 text-4xl leading-tight font-semibold', TONES[tone])}>
          {typeof value === 'number' ? formatNumber(value) : (value ?? '—')}
        </p>
      )}
      {hint === undefined ? null : (
        <p className="mt-1 text-xs text-[var(--fd-text-tertiary)]">{hint}</p>
      )}
    </>
  );

  const shell = cn(
    'block rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] p-4',
    to === undefined
      ? ''
      : 'transition-colors hover:border-[var(--fd-border-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]',
    className,
  );

  if (to === undefined) return <div className={shell}>{body}</div>;

  return (
    <Link to={to} className={shell}>
      {body}
    </Link>
  );
}
