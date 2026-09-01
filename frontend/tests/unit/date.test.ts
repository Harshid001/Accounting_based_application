import { describe, expect, it } from 'vitest';

import {
  addDaysDateOnly,
  daysUntil,
  formatDate,
  formatDateTime,
  isPastDateOnly,
  parseTypedDate,
  relativeDeadline,
  toDateOnly,
  todayDateOnly,
} from '@/lib/date';

describe('formatDate', () => {
  it('renders a date-only string in the 29 Jul 2026 form', () => {
    expect(formatDate('2026-07-29')).toBe('29 Jul 2026');
  });

  it('never renders the ambiguous numeric form', () => {
    expect(formatDate('2026-07-29')).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('renders a UTC timestamp in IST, rolling the day where IST is ahead', () => {
    expect(formatDate('2026-07-29T20:30:00.000Z')).toBe('30 Jul 2026');
  });

  it('returns the fallback for null, undefined and unparsable input', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('not a date', 'None')).toBe('None');
  });
});

describe('formatDateTime', () => {
  it('renders the IST clock time alongside the date', () => {
    expect(formatDateTime('2026-07-29T04:00:00.000Z')).toBe('29 Jul 2026, 09:30');
  });
});

describe('toDateOnly', () => {
  it('converts a UTC timestamp to the IST calendar day', () => {
    expect(toDateOnly('2026-07-29T20:30:00.000Z')).toBe('2026-07-30');
  });

  it('passes a date-only string through unchanged', () => {
    expect(toDateOnly('2026-04-01')).toBe('2026-04-01');
  });
});

describe('addDaysDateOnly', () => {
  it('adds days and crosses a month boundary', () => {
    expect(addDaysDateOnly('2026-07-29', 5)).toBe('2026-08-03');
  });

  it('subtracts with a negative offset', () => {
    expect(addDaysDateOnly('2026-03-02', -2)).toBe('2026-02-28');
  });
});

describe('isPastDateOnly and daysUntil', () => {
  it('treats today as not past', () => {
    expect(isPastDateOnly(todayDateOnly())).toBe(false);
    expect(daysUntil(todayDateOnly())).toBe(0);
  });

  it('treats yesterday as past', () => {
    expect(isPastDateOnly(addDaysDateOnly(todayDateOnly(), -1))).toBe(true);
  });

  it('returns null for a missing value', () => {
    expect(daysUntil(null)).toBeNull();
    expect(isPastDateOnly(null)).toBe(false);
  });
});

describe('relativeDeadline', () => {
  it('names today, tomorrow and an overdue day in words', () => {
    const today = todayDateOnly();
    expect(relativeDeadline(today)).toBe('due today');
    expect(relativeDeadline(addDaysDateOnly(today, 1))).toBe('due tomorrow');
    expect(relativeDeadline(addDaysDateOnly(today, -1))).toBe('1 day overdue');
    expect(relativeDeadline(addDaysDateOnly(today, -4))).toBe('4 days overdue');
    expect(relativeDeadline(addDaysDateOnly(today, 6))).toBe('in 6 days');
  });
});

describe('parseTypedDate', () => {
  it('accepts the DD MMM YYYY form the date input shows', () => {
    expect(parseTypedDate('29 Jul 2026')).toBe('2026-07-29');
  });

  it('accepts an ISO date unchanged', () => {
    expect(parseTypedDate('2026-07-29')).toBe('2026-07-29');
  });

  it('rejects nonsense and empty input', () => {
    expect(parseTypedDate('the fourth of never')).toBeNull();
    expect(parseTypedDate('   ')).toBeNull();
  });
});
