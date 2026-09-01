import * as RadixSwitch from '@radix-ui/react-switch';
import { useId } from 'react';

import { cn } from '@/lib/cn';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  className,
}: SwitchProps) {
  const id = useId();

  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <label htmlFor={id} className="min-w-0 text-base text-[var(--fd-text-primary)]">
        {label}
        {description === undefined ? null : (
          <span className="mt-0.5 block text-xs text-[var(--fd-text-tertiary)]">{description}</span>
        )}
      </label>
      <RadixSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent',
          'bg-[var(--fd-surface-3)] transition-colors duration-[var(--fd-duration-fast)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]',
          'data-[state=checked]:bg-[var(--fd-accent)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <RadixSwitch.Thumb
          className={cn(
            'block h-3.5 w-3.5 translate-x-1 rounded-full bg-[var(--fd-text-primary)]',
            'transition-transform duration-[var(--fd-duration-fast)]',
            'data-[state=checked]:translate-x-4 data-[state=checked]:bg-[var(--fd-accent-contrast)]',
          )}
        />
      </RadixSwitch.Root>
    </div>
  );
}
