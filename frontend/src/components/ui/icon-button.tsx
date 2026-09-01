import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

import { cn } from '@/lib/cn';
import { Spinner } from '@/components/ui/skeleton';
import type { ButtonVariant } from '@/components/ui/button';

export type IconButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--fd-accent)] text-[var(--fd-accent-contrast)] hover:bg-[var(--fd-accent-hover)]',
  secondary:
    'border border-[var(--fd-border)] bg-[var(--fd-surface-1)] text-[var(--fd-text-primary)] hover:bg-[var(--fd-surface-3)]',
  ghost:
    'text-[var(--fd-text-secondary)] hover:bg-[var(--fd-surface-3)] hover:text-[var(--fd-text-primary)]',
  danger: 'bg-[var(--fd-status-danger)] text-[var(--fd-accent-contrast)] hover:brightness-110',
  link: 'text-[var(--fd-accent)] hover:text-[var(--fd-accent-hover)]',
};

const SIZES: Record<IconButtonSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
};

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  variant?: ButtonVariant;
  size?: IconButtonSize;
  loading?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    label,
    icon,
    className,
    variant = 'ghost',
    size = 'md',
    loading = false,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md transition-colors',
        'duration-[var(--fd-duration-fast)] focus-visible:outline-2 focus-visible:outline-offset-2',
        'focus-visible:outline-[var(--fd-focus-ring)] disabled:cursor-not-allowed disabled:opacity-55',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner size={14} /> : icon}
    </button>
  );
});
