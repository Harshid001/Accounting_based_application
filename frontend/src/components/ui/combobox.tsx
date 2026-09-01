import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown, X } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/skeleton';

export interface ComboboxOption {
  value: string;
  label: string;
  hint?: string;
}

export interface ComboboxProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: readonly ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  ariaDescribedBy?: string | undefined;
  ariaLabel?: string;
  onSearchChange?: (term: string) => void;
  allowClear?: boolean;
  className?: string;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Choose one',
  searchPlaceholder = 'Type to filter',
  emptyLabel = 'Nothing matches that search',
  loading = false,
  disabled = false,
  invalid = false,
  id,
  ariaDescribedBy,
  ariaLabel,
  onSearchChange,
  allowClear = true,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (onSearchChange !== undefined) return options;
    const needle = term.trim().toLowerCase();
    if (needle.length === 0) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, term, onSearchChange]);

  const selected = options.find((option) => option.value === value) ?? null;

  const commit = (next: string | null): void => {
    onChange(next);
    setOpen(false);
    setTerm('');
    setActiveIndex(0);
  };

  const onSearch = (next: string): void => {
    setTerm(next);
    setActiveIndex(0);
    onSearchChange?.(next);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div className={cn('relative', className)}>
        <Popover.Trigger asChild>
          <button
            type="button"
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            className={cn(
              'inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3',
              'bg-[var(--fd-surface-1)] text-left text-base transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]',
              'disabled:cursor-not-allowed disabled:bg-[var(--fd-surface-2)] disabled:opacity-70',
              invalid
                ? 'border-[var(--fd-status-danger)]'
                : 'border-[var(--fd-border)] hover:border-[var(--fd-border-strong)]',
              allowClear && selected !== null ? 'pr-14' : '',
            )}
          >
            <span
              className={cn(
                'truncate',
                selected === null
                  ? 'text-[var(--fd-text-tertiary)]'
                  : 'text-[var(--fd-text-primary)]',
              )}
            >
              {selected?.label ?? placeholder}
            </span>
            <ChevronDown size={15} className="text-[var(--fd-text-tertiary)]" aria-hidden="true" />
          </button>
        </Popover.Trigger>

        {allowClear && selected !== null && !disabled ? (
          <button
            type="button"
            onClick={() => {
              commit(null);
            }}
            aria-label={`Clear ${selected.label}`}
            className="absolute top-1/2 right-8 -translate-y-1/2 rounded p-1 text-[var(--fd-text-tertiary)] hover:text-[var(--fd-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]"
          >
            <X size={13} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            searchRef.current?.focus();
          }}
          className={cn(
            'z-50 max-h-72 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-lg',
            'border border-[var(--fd-border)] bg-[var(--fd-surface-1)] shadow-[var(--fd-shadow-overlay)]',
          )}
        >
          <div className="border-b border-[var(--fd-border-subtle)] p-2">
            <Input
              ref={searchRef}
              value={term}
              onChange={(event) => {
                onSearch(event.target.value);
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              aria-controls={listId}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setActiveIndex((index) => Math.max(index - 1, 0));
                } else if (event.key === 'Enter') {
                  event.preventDefault();
                  const option = filtered[activeIndex];
                  if (option !== undefined) commit(option.value);
                }
              }}
            />
          </div>

          <ul id={listId} role="listbox" className="max-h-56 overflow-y-auto p-1">
            {loading ? (
              <li className="flex items-center gap-2 px-2 py-3 text-xs text-[var(--fd-text-tertiary)]">
                <Spinner size={13} /> Searching
              </li>
            ) : filtered.length === 0 ? (
              <li className="px-2 py-3 text-xs text-[var(--fd-text-tertiary)]">{emptyLabel}</li>
            ) : (
              filtered.map((option, index) => (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    onMouseEnter={() => {
                      setActiveIndex(index);
                    }}
                    onClick={() => {
                      commit(option.value);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-base',
                      index === activeIndex
                        ? 'bg-[var(--fd-surface-3)]'
                        : 'hover:bg-[var(--fd-surface-2)]',
                    )}
                  >
                    <Check
                      size={13}
                      aria-hidden="true"
                      className={cn(
                        'shrink-0',
                        option.value === value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.hint === undefined ? null : (
                      <span className="text-2xs shrink-0 text-[var(--fd-text-tertiary)]">
                        {option.hint}
                      </span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
