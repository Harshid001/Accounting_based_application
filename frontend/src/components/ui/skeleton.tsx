import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';
import { SKELETON_DELAY_MS } from '@/lib/constants';

export interface SkeletonProps {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

const RADII = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
} as const;

export function Skeleton({ className, rounded = 'md' }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block bg-[var(--fd-skeleton)]',
        RADII[rounded],
        'motion-safe:animate-[fd-pulse_1.8s_ease-in-out_infinite]',
        className,
      )}
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

export interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

export function Spinner({ size = 16, className, label }: SpinnerProps) {
  return (
    <span
      className={cn('inline-flex items-center justify-center', className)}
      role={label === undefined ? 'presentation' : 'status'}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="motion-safe:animate-[fd-spin_0.8s_linear_infinite]"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {label === undefined ? null : <span className="sr-only">{label}</span>}
    </span>
  );
}

export function useDelayedFlag(active: boolean, delayMs = SKELETON_DELAY_MS): boolean {
  const [shown, setShown] = useState(false);
  const [wasActive, setWasActive] = useState(active);

  if (wasActive !== active) {
    setWasActive(active);
    if (!active) setShown(false);
  }

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      setShown(true);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [active, delayMs]);

  return active && shown;
}
