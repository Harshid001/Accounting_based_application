import { addDays, clampDayToMonth, utcMidnight } from './date.js';
import type { DueDateRuleKind } from './enums.js';

export interface DayOfFollowingMonthRule {
  kind: 'day_of_following_month';
  day: number;
  monthsAfter: number;
}

export interface DaysAfterPeriodEndRule {
  kind: 'days_after_period_end';
  days: number;
}

export interface FixedDayMonthAfterPeriodRule {
  kind: 'fixed_day_month_after_period';
  day: number;
  month: number;
  yearsAfter: number;
}

export type DueDateRule =
  | DayOfFollowingMonthRule
  | DaysAfterPeriodEndRule
  | FixedDayMonthAfterPeriodRule;

export const isDueDateRuleKind = (value: string): value is DueDateRuleKind =>
  value === 'day_of_following_month' ||
  value === 'days_after_period_end' ||
  value === 'fixed_day_month_after_period';

export const evaluateDueDate = (rule: DueDateRule, periodEnd: Date): Date => {
  switch (rule.kind) {
    case 'day_of_following_month': {
      const monthIndex = periodEnd.getUTCMonth() + 1 + rule.monthsAfter;
      const year = periodEnd.getUTCFullYear() + Math.floor((monthIndex - 1) / 12);
      const month = ((((monthIndex - 1) % 12) + 12) % 12) + 1;
      return clampDayToMonth(year, month, rule.day);
    }
    case 'days_after_period_end':
      return addDays(periodEnd, rule.days);
    case 'fixed_day_month_after_period': {
      const year = periodEnd.getUTCFullYear() + rule.yearsAfter;
      return clampDayToMonth(year, rule.month, rule.day);
    }
  }
};

export const describeDueDateRule = (rule: DueDateRule): string => {
  switch (rule.kind) {
    case 'day_of_following_month': {
      if (rule.monthsAfter === 0) return `day ${rule.day} of the period's closing month`;
      const noun = rule.monthsAfter === 1 ? 'month' : 'months';
      return `day ${rule.day}, ${rule.monthsAfter} ${noun} after the period ends`;
    }
    case 'days_after_period_end':
      return `${rule.days} ${rule.days === 1 ? 'day' : 'days'} after the period ends`;
    case 'fixed_day_month_after_period': {
      const reference = utcMidnight(2000, rule.month, 1);
      const monthName = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'UTC',
        month: 'long',
      }).format(reference);
      const suffix =
        rule.yearsAfter === 0
          ? "in the period's closing year"
          : `${rule.yearsAfter} year after the period ends`;
      return `${rule.day} ${monthName}, ${suffix}`;
    }
  }
};

export const dueDateRuleIsValid = (rule: DueDateRule): boolean => {
  switch (rule.kind) {
    case 'day_of_following_month':
      return (
        Number.isInteger(rule.day) &&
        rule.day >= 1 &&
        rule.day <= 31 &&
        Number.isInteger(rule.monthsAfter) &&
        rule.monthsAfter >= 0 &&
        rule.monthsAfter <= 12
      );
    case 'days_after_period_end':
      return Number.isInteger(rule.days) && rule.days >= 0 && rule.days <= 365;
    case 'fixed_day_month_after_period':
      return (
        Number.isInteger(rule.day) &&
        rule.day >= 1 &&
        rule.day <= 31 &&
        Number.isInteger(rule.month) &&
        rule.month >= 1 &&
        rule.month <= 12 &&
        (rule.yearsAfter === 0 || rule.yearsAfter === 1)
      );
  }
};
