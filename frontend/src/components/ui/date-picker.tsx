import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import * as Popover from '@radix-ui/react-popover';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { formatDate, parseTypedDate, todayDateOnly } from '@/lib/date';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';

export interface DatePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  ariaDescribedBy?: string | undefined;
  ariaLabel?: string;
  min?: string;
  max?: string;
  className?: string;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const safeParse = (value: string | null): Date => {
  if (value === null || value.length === 0) return parseISO(`${todayDateOnly()}T00:00:00`);
  const parsed = parseISO(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? parseISO(`${todayDateOnly()}T00:00:00`) : parsed;
};

export function DatePicker({
  value,
  onChange,
  id,
  disabled = false,
  invalid = false,
  ariaDescribedBy,
  ariaLabel = 'Date',
  min,
  max,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(value === null ? '' : formatDate(value, ''));
  const [cursor, setCursor] = useState(() => startOfMonth(safeParse(value)));

  const commitTyped = (raw: string): void => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      onChange(null);
      return;
    }
    const parsed = parseTypedDate(trimmed);
    if (parsed !== null) {
      onChange(parsed);
      setTyped(formatDate(parsed, ''));
      setCursor(startOfMonth(safeParse(parsed)));
    } else {
      setTyped(value === null ? '' : formatDate(value, ''));
    }
  };

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
  });

  const outOfRange = (iso: string): boolean =>
    (min !== undefined && iso < min) || (max !== undefined && iso > max);

  return (
    <div className={cn('relative flex gap-2', className)}>
      <Input
        id={id}
        value={typed}
        disabled={disabled}
        invalid={invalid}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        placeholder="DD MMM YYYY"
        autoComplete="off"
        onChange={(event) => {
          setTyped(event.target.value);
        }}
        onBlur={(event) => {
          commitTyped(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commitTyped(typed);
          }
        }}
      />

      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <IconButton
            label={`Open calendar for ${ariaLabel}`}
            variant="secondary"
            disabled={disabled}
            icon={<CalendarDays size={15} aria-hidden="true" />}
          />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={6}
            className="z-50 w-64 rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] p-3 shadow-[var(--fd-shadow-overlay)]"
          >
            <div className="mb-2 flex items-center justify-between">
              <IconButton
                label="Previous month"
                size="sm"
                icon={<ChevronLeft size={14} aria-hidden="true" />}
                onClick={() => {
                  setCursor((current) => addMonths(current, -1));
                }}
              />
              <span
                aria-live="polite"
                className="text-base font-medium text-[var(--fd-text-primary)]"
              >
                {format(cursor, 'MMMM yyyy')}
              </span>
              <IconButton
                label="Next month"
                size="sm"
                icon={<ChevronRight size={14} aria-hidden="true" />}
                onClick={() => {
                  setCursor((current) => addMonths(current, 1));
                }}
              />
            </div>

            <div
              className="text-2xs mb-1 grid grid-cols-7 gap-0.5 text-[var(--fd-text-tertiary)]"
              aria-hidden="true"
            >
              {WEEKDAYS.map((day) => (
                <span key={day} className="py-1 text-center">
                  {day}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {days.map((day) => {
                const iso = format(day, 'yyyy-MM-dd');
                const selected = value === iso;
                const disabledDay = outOfRange(iso);
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={disabledDay}
                    aria-pressed={selected}
                    aria-label={formatDate(iso)}
                    onClick={() => {
                      onChange(iso);
                      setTyped(formatDate(iso, ''));
                      setOpen(false);
                    }}
                    className={cn(
                      'numeric h-7 rounded-md text-xs transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--fd-focus-ring)]',
                      isSameMonth(day, cursor)
                        ? 'text-[var(--fd-text-primary)]'
                        : 'text-[var(--fd-text-tertiary)]',
                      selected
                        ? 'bg-[var(--fd-accent)] text-[var(--fd-accent-contrast)]'
                        : 'hover:bg-[var(--fd-surface-3)]',
                      disabledDay && 'cursor-not-allowed opacity-35 hover:bg-transparent',
                      iso === todayDateOnly() && !selected
                        ? 'ring-1 ring-[var(--fd-border-strong)] ring-inset'
                        : '',
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex justify-between border-t border-[var(--fd-border-subtle)] pt-2">
              <button
                type="button"
                className="text-xs text-[var(--fd-accent)] hover:underline"
                onClick={() => {
                  const iso = todayDateOnly();
                  onChange(iso);
                  setTyped(formatDate(iso, ''));
                  setOpen(false);
                }}
              >
                Today
              </button>
              <button
                type="button"
                className="text-xs text-[var(--fd-text-tertiary)] hover:underline"
                onClick={() => {
                  onChange(null);
                  setTyped('');
                  setOpen(false);
                }}
              >
                Clear
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
