import { describe, expect, it } from 'vitest';

import { financialYearOf, utcMidnight } from '../../src/lib/date.js';
import {
  enumeratePeriods,
  frequencyToPeriodType,
  nextPeriod,
  periodContaining,
  previousPeriod,
} from '../../src/lib/period.js';

describe('month periods', () => {
  it('spans the whole calendar month and labels it', () => {
    const period = periodContaining('month', utcMidnight(2026, 7, 15));
    expect(period.periodStart).toEqual(utcMidnight(2026, 7, 1));
    expect(period.periodEnd).toEqual(utcMidnight(2026, 7, 31));
    expect(period.periodLabel).toBe('Jul 2026');
  });

  it('ends on 29 February in a leap year', () => {
    const period = periodContaining('month', utcMidnight(2028, 2, 3));
    expect(period.periodEnd).toEqual(utcMidnight(2028, 2, 29));
  });
});

describe('quarter periods', () => {
  it('numbers quarters from the April financial year start', () => {
    expect(periodContaining('quarter', utcMidnight(2026, 4, 1)).periodLabel).toBe(
      'Q1 FY 2026-27',
    );
    expect(periodContaining('quarter', utcMidnight(2026, 8, 20)).periodLabel).toBe(
      'Q2 FY 2026-27',
    );
    expect(periodContaining('quarter', utcMidnight(2026, 11, 5)).periodLabel).toBe(
      'Q3 FY 2026-27',
    );
    expect(periodContaining('quarter', utcMidnight(2027, 2, 9)).periodLabel).toBe(
      'Q4 FY 2026-27',
    );
  });

  it('spans exactly three months', () => {
    const q4 = periodContaining('quarter', utcMidnight(2027, 2, 9));
    expect(q4.periodStart).toEqual(utcMidnight(2027, 1, 1));
    expect(q4.periodEnd).toEqual(utcMidnight(2027, 3, 31));
  });
});

describe('half-year periods', () => {
  it('splits the financial year into April-September and October-March', () => {
    const h1 = periodContaining('half_year', utcMidnight(2026, 5, 1));
    expect(h1.periodStart).toEqual(utcMidnight(2026, 4, 1));
    expect(h1.periodEnd).toEqual(utcMidnight(2026, 9, 30));
    expect(h1.periodLabel).toBe('H1 FY 2026-27');

    const h2 = periodContaining('half_year', utcMidnight(2027, 1, 10));
    expect(h2.periodStart).toEqual(utcMidnight(2026, 10, 1));
    expect(h2.periodEnd).toEqual(utcMidnight(2027, 3, 31));
    expect(h2.periodLabel).toBe('H2 FY 2026-27');
  });
});

describe('financial year periods', () => {
  it('runs April to March and labels the pair of years', () => {
    const fy = periodContaining('financial_year', utcMidnight(2027, 2, 1));
    expect(fy.periodStart).toEqual(utcMidnight(2026, 4, 1));
    expect(fy.periodEnd).toEqual(utcMidnight(2027, 3, 31));
    expect(fy.periodLabel).toBe('FY 2026-27');
  });

  it('agrees with financialYearOf for a March date', () => {
    const fy = financialYearOf(utcMidnight(2026, 3, 31));
    expect(fy.start).toEqual(utcMidnight(2025, 4, 1));
    expect(fy.label).toBe('FY 2025-26');
  });
});

describe('period navigation', () => {
  it('moves to the next and previous period without gaps', () => {
    const july = periodContaining('month', utcMidnight(2026, 7, 10));
    expect(nextPeriod(july).periodStart).toEqual(utcMidnight(2026, 8, 1));
    expect(previousPeriod(july).periodStart).toEqual(utcMidnight(2026, 6, 1));
  });

  it('enumerates every month in a range inclusively', () => {
    const periods = enumeratePeriods('month', utcMidnight(2026, 1, 15), utcMidnight(2026, 4, 2));
    expect(periods.map((period) => period.periodLabel)).toEqual([
      'Jan 2026',
      'Feb 2026',
      'Mar 2026',
      'Apr 2026',
    ]);
  });

  it('returns nothing when the range runs backwards', () => {
    expect(enumeratePeriods('month', utcMidnight(2026, 4, 1), utcMidnight(2026, 1, 1))).toEqual(
      [],
    );
  });

  it('respects the enumeration cap', () => {
    const periods = enumeratePeriods(
      'month',
      utcMidnight(2020, 1, 1),
      utcMidnight(2030, 1, 1),
      12,
    );
    expect(periods).toHaveLength(12);
  });
});

describe('frequency mapping', () => {
  it('maps every frequency to a period type', () => {
    expect(frequencyToPeriodType('monthly')).toBe('month');
    expect(frequencyToPeriodType('quarterly')).toBe('quarter');
    expect(frequencyToPeriodType('half_yearly')).toBe('half_year');
    expect(frequencyToPeriodType('annual')).toBe('financial_year');
    expect(frequencyToPeriodType('one_time')).toBe('financial_year');
  });
});
