import { Slot } from '@radix-ui/react-slot';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

import { cn } from '@/lib/cn';
import { Spinner } from '@/components/ui/skeleton';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'relative inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap ' +
  'transition-all duration-150 ease-out active:scale-[0.98] cursor-pointer ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)] ' +
  'disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--fd-accent)] text-[var(--fd-accent-contrast)] hover:bg-[var(--fd-accent-hover)] ' +
    'hover:shadow-[0_8px_24px_-8px_rgba(255,106,0,0.45)] hover:-translate-y-0.5 ' +
    'active:translate-y-0 active:brightness-95 disabled:hover:bg-[var(--fd-accent)] disabled:hover:shadow-none disabled:hover:translate-y-0',
  secondary:
    'border border-[var(--fd-border)] bg-[var(--fd-surface-2)] text-[var(--fd-text-primary)] ' +
    'hover:border-[var(--fd-accent)] hover:text-[var(--fd-accent-hover)] hover:-translate-y-0.5 hover:shadow-xs ' +
    'active:translate-y-0 active:bg-[var(--fd-surface-2)] active:border-[var(--fd-border)] active:text-[var(--fd-text-primary)] disabled:hover:translate-y-0 disabled:hover:shadow-none',
  ghost:
    'text-[var(--fd-text-secondary)] hover:bg-[var(--fd-surface-3)] ' +
    'hover:text-[var(--fd-text-primary)] active:bg-[var(--fd-surface-2)]',
  danger:
    'bg-[var(--fd-status-danger)] text-[var(--fd-accent-contrast)] hover:brightness-110 hover:-translate-y-0.5 hover:shadow-xs ' +
    'active:translate-y-0 active:brightness-95 disabled:hover:translate-y-0',
  link:
    'text-[var(--fd-accent)] underline underline-offset-4 hover:text-[var(--fd-accent-hover)] ' +
    'px-0',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-base',
  lg: 'h-11 px-5 text-md',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  asChild?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'secondary',
    size = 'md',
    loading = false,
    loadingLabel = 'Working',
    asChild = false,
    iconLeft,
    iconRight,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  const classes = cn(
    BASE,
    VARIANTS[variant],
    variant === 'link' ? 'h-auto py-0' : SIZES[size],
    className,
  );

  if (asChild) {
    return (
      <Slot ref={ref} className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible flex items-center gap-2" aria-hidden="true">
            {iconLeft}
            {children}
            {iconRight}
          </span>
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner size={size === 'lg' ? 18 : 14} />
            <span className="sr-only">{loadingLabel}</span>
          </span>
        </>
      ) : (
        <>
          {iconLeft}
          {children}
          {iconRight}
        </>
      )}
    </button>
  );
});
