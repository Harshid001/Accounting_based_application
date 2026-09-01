import type { InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

import { cn } from '@/lib/cn';

export const inputClasses = (invalid: boolean, className?: string): string =>
  cn(
    'h-9 w-full rounded-md border bg-[var(--fd-surface-1)] px-3 text-base',
    'text-[var(--fd-text-primary)] placeholder:text-[var(--fd-text-tertiary)]',
    'transition-colors duration-[var(--fd-duration-fast)]',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]',
    'disabled:cursor-not-allowed disabled:bg-[var(--fd-surface-2)] disabled:text-[var(--fd-text-tertiary)]',
    'read-only:bg-[var(--fd-surface-2)] read-only:text-[var(--fd-text-secondary)]',
    invalid
      ? 'border-[var(--fd-status-danger)]'
      : 'border-[var(--fd-border)] hover:border-[var(--fd-border-strong)]',
    className,
  );

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  invalid?: boolean;
  numeric?: boolean;
  prefix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid = false, numeric = false, prefix, ...props },
  ref,
) {
  const field = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(inputClasses(invalid, className), numeric && 'numeric', prefix && 'pl-8')}
      {...props}
    />
  );

  if (prefix === undefined) return field;

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--fd-text-tertiary)]"
      >
        {prefix}
      </span>
      {field}
    </div>
  );
});
