import {
  addDays,
  daysInMonth,
  financialYearOf,
  startOfMonth,
  utcMidnight,
} from './date.js';
import type { Frequency, PeriodType } from './enums.js';

export interface Period {
  periodType: PeriodType;
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const monthName = (month: number): string => MONTH_NAMES[month - 1] ?? 'Jan';

export const frequencyToPeriodType = (frequency: Frequency): PeriodType => {
  switch (frequency) {
    case 'monthly':
      return 'month';
    case 'quarterly':
      return 'quarter';
    case 'half_yearly':
      return 'half_year';
    case 'annual':
    case 'one_time':
      return 'financial_year';
  }
};

const financialQuarterIndex = (month: number): number => {
  if (month >= 4 && month <= 6) return 0;
  if (month >= 7 && month <= 9) return 1;
  if (month >= 10 && month <= 12) return 2;
  return 3;
};

const monthPeriod = (anchor: Date): Period => {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth() + 1;
  return {
    periodType: 'month',
    periodStart: utcMidnight(year, month, 1),
    periodEnd: utcMidnight(year, month, daysInMonth(year, month)),
    periodLabel: `${monthName(month)} ${year}`,
  };
};

const quarterPeriod = (anchor: Date): Period => {
  const fy = financialYearOf(anchor);
  const index = financialQuarterIndex(anchor.getUTCMonth() + 1);
  const startMonthAbsolute = 4 + index * 3;
  const startYear = fy.start.getUTCFullYear() + (startMonthAbsolute > 12 ? 1 : 0);
  const startMonth = startMonthAbsolute > 12 ? startMonthAbsolute - 12 : startMonthAbsolute;
  const endMonthAbsolute = startMonthAbsolute + 2;
  const endYear = fy.start.getUTCFullYear() + (endMonthAbsolute > 12 ? 1 : 0);
  const endMonth = endMonthAbsolute > 12 ? endMonthAbsolute - 12 : endMonthAbsolute;
  return {
    periodType: 'quarter',
    periodStart: utcMidnight(startYear, startMonth, 1),
    periodEnd: utcMidnight(endYear, endMonth, daysInMonth(endYear, endMonth)),
    periodLabel: `Q${index + 1} ${fy.label}`,
  };
};

const halfYearPeriod = (anchor: Date): Period => {
  const fy = financialYearOf(anchor);
  const month = anchor.getUTCMonth() + 1;
  const isFirstHalf = month >= 4 && month <= 9;
  const startYear = fy.start.getUTCFullYear();
  if (isFirstHalf) {
    return {
      periodType: 'half_year',
      periodStart: utcMidnight(startYear, 4, 1),
      periodEnd: utcMidnight(startYear, 9, 30),
      periodLabel: `H1 ${fy.label}`,
    };
  }
  return {
    periodType: 'half_year',
    periodStart: utcMidnight(startYear, 10, 1),
    periodEnd: utcMidnight(startYear + 1, 3, 31),
    periodLabel: `H2 ${fy.label}`,
  };
};

const financialYearPeriod = (anchor: Date): Period => {
  const fy = financialYearOf(anchor);
  return {
    periodType: 'financial_year',
    periodStart: fy.start,
    periodEnd: fy.end,
    periodLabel: fy.label,
  };
};

export const periodContaining = (periodType: PeriodType, anchor: Date): Period => {
  switch (periodType) {
    case 'month':
      return monthPeriod(anchor);
    case 'quarter':
      return quarterPeriod(anchor);
    case 'half_year':
      return halfYearPeriod(anchor);
    case 'financial_year':
      return financialYearPeriod(anchor);
  }
};

export const nextPeriod = (period: Period): Period =>
  periodContaining(period.periodType, addDays(period.periodEnd, 1));

export const previousPeriod = (period: Period): Period =>
  periodContaining(period.periodType, addDays(period.periodStart, -1));

export const enumeratePeriods = (
  periodType: PeriodType,
  from: Date,
  to: Date,
  limit = 400,
): Period[] => {
  if (to.getTime() < from.getTime()) return [];
  const periods: Period[] = [];
  let current = periodContaining(periodType, from);
  while (current.periodStart.getTime() <= to.getTime() && periods.length < limit) {
    periods.push(current);
    current = nextPeriod(current);
  }
  return periods;
};

export const periodLabelFor = (periodType: PeriodType, periodStart: Date): string =>
  periodContaining(periodType, startOfMonth(periodStart)).periodLabel;
