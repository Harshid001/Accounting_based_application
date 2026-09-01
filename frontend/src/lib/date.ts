export const IST = 'Asia/Kolkata';

const displayFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: IST,
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: IST,
});

const timeFormatter = new Intl.DateTimeFormat('en-IN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: IST,
});

const isoPartsFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: IST,
});

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const toDate = (value: string | Date | null | undefined): Date | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = DATE_ONLY.test(trimmed) ? new Date(`${trimmed}T00:00:00Z`) : new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDate = (value: string | Date | null | undefined, fallback = '—'): string => {
  const date = toDate(value);
  if (date === null) return fallback;
  return displayFormatter.format(date).replace(/\s+/g, ' ');
};

export const formatDateTime = (
  value: string | Date | null | undefined,
  fallback = '—',
): string => {
  const date = toDate(value);
  if (date === null) return fallback;
  return dateTimeFormatter.format(date).replace(/,\s*/, ', ').replace(/\s+/g, ' ');
};

export const formatTime = (value: string | Date | null | undefined, fallback = '—'): string => {
  const date = toDate(value);
  return date === null ? fallback : timeFormatter.format(date);
};

export const toDateOnly = (value: string | Date | null | undefined): string | null => {
  const date = toDate(value);
  return date === null ? null : isoPartsFormatter.format(date);
};

export const todayDateOnly = (): string => isoPartsFormatter.format(new Date());

export const addDaysDateOnly = (dateOnly: string, days: number): string => {
  const base = toDate(dateOnly);
  if (base === null) return dateOnly;
  const next = new Date(base.getTime() + days * 86_400_000);
  return isoPartsFormatter.format(next);
};

export const isPastDateOnly = (value: string | null | undefined): boolean => {
  if (value === null || value === undefined) return false;
  const asDay = toDateOnly(value);
  return asDay !== null && asDay < todayDateOnly();
};

export const daysUntil = (value: string | null | undefined): number | null => {
  const target = toDate(value);
  if (target === null) return null;
  const today = toDate(todayDateOnly());
  if (today === null) return null;
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
};

export const relativeDeadline = (value: string | null | undefined): string => {
  const days = daysUntil(value);
  if (days === null) return '';
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  if (days === -1) return '1 day overdue';
  if (days < 0) return `${Math.abs(days)} days overdue`;
  return `in ${days} days`;
};

export const relativeTime = (value: string | Date | null | undefined): string => {
  const date = toDate(value);
  if (date === null) return '';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return formatDate(date);
};

export const parseTypedDate = (input: string): string | null => {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  if (DATE_ONLY.test(trimmed)) return trimmed;
  const parsed = new Date(`${trimmed} UTC`);
  if (Number.isNaN(parsed.getTime())) return null;
  return isoPartsFormatter.format(parsed);
};
