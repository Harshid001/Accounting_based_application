import { validationFailed } from './errors.js';

export const IST_TIMEZONE = 'Asia/Kolkata';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const istParts = (instant: Date): { year: number; month: number; day: number } => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type);
    return found ? Number(found.value) : Number.NaN;
  };
  return { year: read('year'), month: read('month'), day: read('day') };
};

export const utcMidnight = (year: number, month: number, day: number): Date =>
  new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

export const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

export const clampDayToMonth = (year: number, month: number, day: number): Date =>
  utcMidnight(year, month, Math.min(Math.max(day, 1), daysInMonth(year, month)));

export const toDateOnly = (value: Date): Date =>
  utcMidnight(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());

export const parseDateOnly = (value: string, field = 'date'): Date => {
  if (!DATE_ONLY.test(value)) {
    throw validationFailed(`${field} must be a calendar date in the form YYYY-MM-DD.`, [
      { field, message: 'Use the form YYYY-MM-DD, for example 2026-07-29.' },
    ]);
  }
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw validationFailed(`${field} is not a real calendar date.`, [
      { field, message: `${value} does not exist on the calendar.` },
    ]);
  }
  return utcMidnight(year, month, day);
};

export const formatDateOnly = (value: Date | null | undefined): string | null => {
  if (!value) return null;
  const year = value.getUTCFullYear().toString().padStart(4, '0');
  const month = (value.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = value.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const todayIST = (now: Date = new Date()): Date => {
  const { year, month, day } = istParts(now);
  return utcMidnight(year, month, day);
};

export const addDays = (value: Date, days: number): Date => {
  const next = new Date(value.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return toDateOnly(next);
};

export const addMonths = (value: Date, months: number): Date => {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth() + 1 + months;
  const normalisedYear = year + Math.floor((month - 1) / 12);
  const normalisedMonth = ((((month - 1) % 12) + 12) % 12) + 1;
  return clampDayToMonth(normalisedYear, normalisedMonth, value.getUTCDate());
};

export const startOfMonth = (value: Date): Date =>
  utcMidnight(value.getUTCFullYear(), value.getUTCMonth() + 1, 1);

export const endOfMonth = (value: Date): Date => {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth() + 1;
  return utcMidnight(year, month, daysInMonth(year, month));
};

export const differenceInDays = (later: Date, earlier: Date): number =>
  Math.round((toDateOnly(later).getTime() - toDateOnly(earlier).getTime()) / 86_400_000);

export const isSameDateOnly = (a: Date | null, b: Date | null): boolean => {
  if (a === null || b === null) return a === b;
  return toDateOnly(a).getTime() === toDateOnly(b).getTime();
};

const displayFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TIMEZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export const formatDisplayDate = (value: Date | null | undefined): string => {
  if (!value) return '';
  return displayFormatter.format(value).replace(/\u00A0|\u202F/g, ' ');
};

export const financialYearOf = (value: Date): { start: Date; end: Date; label: string } => {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  const start = utcMidnight(startYear, 4, 1);
  const end = utcMidnight(startYear + 1, 3, 31);
  const label = `FY ${startYear}-${(startYear + 1).toString().slice(-2)}`;
  return { start, end, label };
};
