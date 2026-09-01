import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { useId } from 'react';

import { cn } from '@/lib/cn';

export interface CheckboxProps {
  checked: boolean | 'indeterminate';
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  hideLabel?: boolean;
  className?: string;
  id?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  hideLabel = false,
  className,
  id,
}: CheckboxProps) {
  const generated = useId();
  const controlId = id ?? generated;

  return (
    <div className={cn('flex items-start gap-2', className)}>
      <RadixCheckbox.Root
        id={controlId}
        checked={checked}
        onCheckedChange={(next) => {
          onCheckedChange(next === true);
        }}
        disabled={disabled}
        className={cn(
          'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
          'border-[var(--fd-border-strong)] bg-[var(--fd-surface-1)] transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]',
          'data-[state=checked]:border-[var(--fd-accent)] data-[state=checked]:bg-[var(--fd-accent)]',
          'data-[state=indeterminate]:border-[var(--fd-accent)] data-[state=indeterminate]:bg-[var(--fd-accent)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <RadixCheckbox.Indicator className="text-[var(--fd-accent-contrast)]">
          {checked === 'indeterminate' ? (
            <Minus size={11} aria-hidden="true" />
          ) : (
            <Check size={11} aria-hidden="true" />
          )}
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>

      <label
        htmlFor={controlId}
        className={cn(
          'text-base leading-5 text-[var(--fd-text-primary)]',
          disabled && 'opacity-60',
          hideLabel && 'sr-only',
        )}
      >
        {label}
        {description === undefined ? null : (
          <span className="block text-xs text-[var(--fd-text-tertiary)]">{description}</span>
        )}
      </label>
    </div>
  );
}
