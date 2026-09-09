const numberFormatter = new Intl.NumberFormat('en-IN');

export const formatNumber = (value: number | null | undefined, fallback = '—'): string =>
  value === null || value === undefined || Number.isNaN(value)
    ? fallback
    : numberFormatter.format(value);

export const formatBytes = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit] ?? 'GB'}`;
};

export const formatMinutes = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined || minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
};

export const titleCase = (value: string): string =>
  value
    .split(/[\s_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

export const initialsOf = (name: string | null | undefined): string => {
  if (name === null || name === undefined) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  const initials = `${first}${last}`.toUpperCase();
  return initials.length > 0 ? initials : '?';
};

export const truncate = (value: string, max: number): string =>
  value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;

export const pluralise = (count: number, singular: string, plural?: string): string =>
  `${formatNumber(count)} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;

export const joinNames = (names: readonly string[], max = 2): string => {
  if (names.length === 0) return '—';
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} +${names.length - max}`;
};

export const maskFilename = (filename: string, max = 34): string => {
  if (filename.length <= max) return filename;
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return truncate(filename, max);
  const extension = filename.slice(dot);
  const stem = filename.slice(0, dot);
  return `${stem.slice(0, Math.max(1, max - extension.length - 1))}…${extension}`;
};

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Integer paise -> "₹1,18,000.00". */
export const formatPaise = (paise: number | null | undefined, fallback = '—'): string =>
  paise === null || paise === undefined || Number.isNaN(paise)
    ? fallback
    : currencyFormatter.format(paise / 100).replace(/\u00A0|\u202F/g, ' ');

/** "1234.5" (rupees, typed) -> 123450 paise; null when not a clean 2dp amount. */
export const rupeesStringToPaise = (raw: string): number | null => {
  const trimmed = raw.trim().replace(/,/g, '');
  if (trimmed.length === 0) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
};

export const paiseToRupeesString = (paise: number): string => (paise / 100).toFixed(2);
