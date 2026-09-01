import type { ReactNode } from 'react';
import { useId } from 'react';

import { cn } from '@/lib/cn';

export interface FieldIds {
  inputId: string;
  describedBy: string | undefined;
  invalid: boolean;
}

export interface FormFieldProps {
  label: string;
  required?: boolean;
  helper?: ReactNode;
  error?: string | undefined;
  hideLabel?: boolean;
  className?: string;
  children: (ids: FieldIds) => ReactNode;
}

export function FormField({
  label,
  required = false,
  helper,
  error,
  hideLabel = false,
  className,
  children,
}: FormFieldProps) {
  const base = useId();
  const inputId = `${base}-input`;
  const helperId = `${base}-helper`;
  const errorId = `${base}-error`;
  const invalid = typeof error === 'string' && error.length > 0;
  const describedBy = invalid ? errorId : helper !== undefined ? helperId : undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={inputId}
        className={cn(
          'text-xs font-medium text-[var(--fd-text-secondary)]',
          hideLabel && 'sr-only',
        )}
      >
        {label}
        {required ? (
          <span className="ml-1 text-[var(--fd-status-danger)]" aria-hidden="true">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>

      {children({ inputId, describedBy, invalid })}

      {invalid ? (
        <p id={errorId} className="text-xs text-[var(--fd-status-danger)]">
          {error}
        </p>
      ) : helper !== undefined ? (
        <p id={helperId} className="text-xs text-[var(--fd-text-tertiary)]">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export interface FieldsetProps {
  legend: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function Fieldset({ legend, description, children, className }: FieldsetProps) {
  return (
    <fieldset className={cn('min-w-0 border-0 p-0', className)}>
      <legend className="mb-1 text-lg font-semibold text-[var(--fd-text-primary)]">{legend}</legend>
      {description === undefined ? null : (
        <p className="mb-4 text-xs text-[var(--fd-text-tertiary)]">{description}</p>
      )}
      <div className="flex flex-col gap-4">{children}</div>
    </fieldset>
  );
}

export function FieldRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-4 sm:grid-cols-2', className)}>{children}</div>;
}
