import * as RadixProgress from '@radix-ui/react-progress';

import { cn } from '@/lib/cn';

export interface ProgressBarProps {
  value: number;
  max?: number;
  label: string;
  showValue?: boolean;
  tone?: 'accent' | 'done' | 'waiting';
  className?: string;
}

const TONES = {
  accent: 'bg-[var(--fd-accent)]',
  done: 'bg-[var(--fd-status-done)]',
  waiting: 'bg-[var(--fd-status-waiting)]',
} as const;

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  tone = 'accent',
  className,
}: ProgressBarProps) {
  const safeMax = max <= 0 ? 1 : max;
  const clamped = Math.max(0, Math.min(value, safeMax));
  const percent = Math.round((clamped / safeMax) * 100);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <RadixProgress.Root
        value={clamped}
        max={safeMax}
        aria-label={label}
        className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--fd-surface-3)]"
      >
        <RadixProgress.Indicator
          className={cn('h-full transition-[width] duration-[var(--fd-duration-base)]', TONES[tone])}
          style={{ width: `${percent}%` }}
        />
      </RadixProgress.Root>
      {showValue ? (
        <span className="numeric shrink-0 text-xs text-[var(--fd-text-tertiary)]">
          {clamped} / {safeMax}
        </span>
      ) : null}
    </div>
  );
}
