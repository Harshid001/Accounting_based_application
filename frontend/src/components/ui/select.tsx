import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  ariaDescribedBy?: string | undefined;
  ariaLabel?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Choose one',
  id,
  name,
  disabled = false,
  invalid = false,
  ariaDescribedBy,
  ariaLabel,
  className,
  size = 'md',
}: SelectProps) {
  return (
    <RadixSelect.Root
      value={value ?? ''}
      onValueChange={onValueChange}
      disabled={disabled}
      name={name}
    >
      <RadixSelect.Trigger
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        className={cn(
          'inline-flex w-full items-center justify-between gap-2 rounded-md border',
          'bg-[var(--fd-surface-1)] px-3 text-left text-base text-[var(--fd-text-primary)]',
          'transition-colors duration-[var(--fd-duration-fast)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]',
          'disabled:cursor-not-allowed disabled:bg-[var(--fd-surface-2)] disabled:opacity-70',
          'data-[placeholder]:text-[var(--fd-text-tertiary)]',
          size === 'sm' ? 'h-8 text-xs' : 'h-9',
          invalid
            ? 'border-[var(--fd-status-danger)]'
            : 'border-[var(--fd-border)] hover:border-[var(--fd-border-strong)]',
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown size={15} className="text-[var(--fd-text-tertiary)]" aria-hidden="true" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className={cn(
            'z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg',
            'border border-[var(--fd-border)] bg-[var(--fd-surface-1)] shadow-[var(--fd-shadow-overlay)]',
          )}
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled === true}
                className={cn(
                  'relative flex cursor-default items-center gap-2 rounded-md py-1.5 pr-2 pl-7',
                  'text-base text-[var(--fd-text-primary)] outline-none select-none',
                  'data-[highlighted]:bg-[var(--fd-surface-3)]',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                )}
              >
                <RadixSelect.ItemIndicator className="absolute left-2 inline-flex">
                  <Check size={13} aria-hidden="true" />
                </RadixSelect.ItemIndicator>
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
