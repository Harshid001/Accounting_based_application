export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

const FORMULA_LEAD = /^[=+\-@\t\r]/;

export const escapeCsvCell = (raw: string | number | boolean | null | undefined): string => {
  if (raw === null || raw === undefined) return '';
  const text = String(raw);
  const guarded = FORMULA_LEAD.test(text) ? `'${text}` : text;
  if (/["\n\r,]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
};

export const buildCsv = <T>(rows: readonly T[], columns: ReadonlyArray<CsvColumn<T>>): string => {
  const lines: string[] = [columns.map((column) => escapeCsvCell(column.header)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => escapeCsvCell(column.value(row))).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
};

export const csvFilename = (base: string, now: Date = new Date()): string => {
  const stamp = now.toISOString().slice(0, 10);
  const safeBase = base.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  return `${safeBase}-${stamp}.csv`;
};
