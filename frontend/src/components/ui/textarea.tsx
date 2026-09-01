import type { TextareaHTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '@/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid = false, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        'w-full resize-y rounded-md border bg-[var(--fd-surface-1)] px-3 py-2 text-base',
        'text-[var(--fd-text-primary)] placeholder:text-[var(--fd-text-tertiary)]',
        'transition-colors duration-[var(--fd-duration-fast)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]',
        'disabled:cursor-not-allowed disabled:bg-[var(--fd-surface-2)]',
        'read-only:bg-[var(--fd-surface-2)] read-only:text-[var(--fd-text-secondary)]',
        invalid
          ? 'border-[var(--fd-status-danger)]'
          : 'border-[var(--fd-border)] hover:border-[var(--fd-border-strong)]',
        className,
      )}
      {...props}
    />
  );
});
