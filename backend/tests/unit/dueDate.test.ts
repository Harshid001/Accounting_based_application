import { describe, expect, it } from 'vitest';

import { utcMidnight } from '../../src/lib/date.js';
import {
  describeDueDateRule,
  dueDateRuleIsValid,
  evaluateDueDate,
} from '../../src/lib/dueDate.js';

describe('day_of_following_month', () => {
  it('lands on day N of the month after the period ends', () => {
    const due = evaluateDueDate(
      { kind: 'day_of_following_month', day: 20, monthsAfter: 1 },
      utcMidnight(2026, 6, 30),
    );
    expect(due).toEqual(utcMidnight(2026, 7, 20));
  });

  it('clamps day 31 to the last day of a 30-day month', () => {
    const due = evaluateDueDate(
      { kind: 'day_of_following_month', day: 31, monthsAfter: 1 },
      utcMidnight(2026, 3, 31),
    );
    expect(due).toEqual(utcMidnight(2026, 4, 30));
  });

  it('clamps day 31 to the last day of February in a non-leap year', () => {
    const due = evaluateDueDate(
      { kind: 'day_of_following_month', day: 31, monthsAfter: 1 },
      utcMidnight(2026, 1, 31),
    );
    expect(due).toEqual(utcMidnight(2026, 2, 28));
  });

  it('clamps day 31 to 29 February in a leap year', () => {
    const due = evaluateDueDate(
      { kind: 'day_of_following_month', day: 31, monthsAfter: 1 },
      utcMidnight(2028, 1, 31),
    );
    expect(due).toEqual(utcMidnight(2028, 2, 29));
  });

  it('rolls into the next calendar year when monthsAfter crosses December', () => {
    const due = evaluateDueDate(
      { kind: 'day_of_following_month', day: 11, monthsAfter: 2 },
      utcMidnight(2026, 12, 31),
    );
    expect(due).toEqual(utcMidnight(2027, 2, 11));
  });

  it('treats monthsAfter zero as the period closing month', () => {
    const due = evaluateDueDate(
      { kind: 'day_of_following_month', day: 5, monthsAfter: 0 },
      utcMidnight(2026, 9, 30),
    );
    expect(due).toEqual(utcMidnight(2026, 9, 5));
  });
});

describe('days_after_period_end', () => {
  it('adds a whole number of days', () => {
    const due = evaluateDueDate(
      { kind: 'days_after_period_end', days: 15 },
      utcMidnight(2026, 6, 30),
    );
    expect(due).toEqual(utcMidnight(2026, 7, 15));
  });

  it('handles zero days as the period end itself', () => {
    const due = evaluateDueDate(
      { kind: 'days_after_period_end', days: 0 },
      utcMidnight(2026, 6, 30),
    );
    expect(due).toEqual(utcMidnight(2026, 6, 30));
  });

  it('crosses a year boundary correctly', () => {
    const due = evaluateDueDate(
      { kind: 'days_after_period_end', days: 45 },
      utcMidnight(2026, 12, 31),
    );
    expect(due).toEqual(utcMidnight(2027, 2, 14));
  });
});

describe('fixed_day_month_after_period', () => {
  it('resolves to the fixed date in the period closing year', () => {
    const due = evaluateDueDate(
      { kind: 'fixed_day_month_after_period', day: 31, month: 7, yearsAfter: 0 },
      utcMidnight(2026, 3, 31),
    );
    expect(due).toEqual(utcMidnight(2026, 7, 31));
  });

  it('resolves a year later when yearsAfter is one', () => {
    const due = evaluateDueDate(
      { kind: 'fixed_day_month_after_period', day: 30, month: 9, yearsAfter: 1 },
      utcMidnight(2026, 3, 31),
    );
    expect(due).toEqual(utcMidnight(2027, 9, 30));
  });

  it('clamps 31 February to the end of the month', () => {
    const due = evaluateDueDate(
      { kind: 'fixed_day_month_after_period', day: 31, month: 2, yearsAfter: 0 },
      utcMidnight(2026, 1, 31),
    );
    expect(due).toEqual(utcMidnight(2026, 2, 28));
  });
});

describe('rule validation and description', () => {
  it('rejects a day outside 1 to 31', () => {
    expect(
      dueDateRuleIsValid({ kind: 'day_of_following_month', day: 32, monthsAfter: 1 }),
    ).toBe(false);
  });

  it('rejects more than 365 days after period end', () => {
    expect(dueDateRuleIsValid({ kind: 'days_after_period_end', days: 400 })).toBe(false);
  });

  it('rejects yearsAfter beyond one', () => {
    expect(
      dueDateRuleIsValid({
        kind: 'fixed_day_month_after_period',
        day: 1,
        month: 4,
        yearsAfter: 3,
      }),
    ).toBe(false);
  });

  it('accepts each well-formed rule', () => {
    expect(dueDateRuleIsValid({ kind: 'day_of_following_month', day: 20, monthsAfter: 1 })).toBe(
      true,
    );
    expect(dueDateRuleIsValid({ kind: 'days_after_period_end', days: 15 })).toBe(true);
    expect(
      dueDateRuleIsValid({
        kind: 'fixed_day_month_after_period',
        day: 31,
        month: 7,
        yearsAfter: 0,
      }),
    ).toBe(true);
  });

  it('describes every rule shape in plain words', () => {
    expect(
      describeDueDateRule({ kind: 'day_of_following_month', day: 20, monthsAfter: 1 }),
    ).toContain('20');
    expect(describeDueDateRule({ kind: 'days_after_period_end', days: 1 })).toContain('1 day');
    expect(
      describeDueDateRule({
        kind: 'fixed_day_month_after_period',
        day: 31,
        month: 7,
        yearsAfter: 0,
      }),
    ).toContain('July');
  });
});
