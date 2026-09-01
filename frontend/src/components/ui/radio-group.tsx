import * as RadixRadio from '@radix-ui/react-radio-group';
import { useId } from 'react';

import { cn } from '@/lib/cn';

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: readonly RadioOption[];
  legend: string;
  hideLegend?: boolean;
  orientation?: 'vertical' | 'horizontal';
  disabled?: boolean;
  className?: string;
}

export function RadioGroup({
  value,
  onValueChange,
  options,
  legend,
  hideLegend = false,
  orientation = 'vertical',
  disabled = false,
  className,
}: RadioGroupProps) {
  const base = useId();

  return (
    <fieldset className={cn('min-w-0 border-0 p-0', className)}>
      <legend
        className={cn(
          'mb-2 text-xs font-medium text-[var(--fd-text-secondary)]',
          hideLegend && 'sr-only',
        )}
      >
        {legend}
      </legend>
      <RadixRadio.Root
        value={value ?? ''}
        onValueChange={onValueChange}
        disabled={disabled}
        orientation={orientation}
        className={cn('flex gap-3', orientation === 'vertical' ? 'flex-col' : 'flex-wrap')}
      >
        {options.map((option) => {
          const id = `${base}-${option.value}`;
          return (
            <div key={option.value} className="flex items-start gap-2">
              <RadixRadio.Item
                id={id}
                value={option.value}
                disabled={option.disabled === true}
                className={cn(
                  'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                  'border-[var(--fd-border-strong)] bg-[var(--fd-surface-1)] transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]',
                  'data-[state=checked]:border-[var(--fd-accent)]',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                <RadixRadio.Indicator className="block h-2 w-2 rounded-full bg-[var(--fd-accent)]" />
              </RadixRadio.Item>
              <label htmlFor={id} className="text-base leading-5 text-[var(--fd-text-primary)]">
                {option.label}
                {option.description === undefined ? null : (
                  <span className="block text-xs text-[var(--fd-text-tertiary)]">
                    {option.description}
                  </span>
                )}
              </label>
            </div>
          );
        })}
      </RadixRadio.Root>
    </fieldset>
  );
}
