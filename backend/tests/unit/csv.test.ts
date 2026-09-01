import { describe, expect, it } from 'vitest';

import { buildCsv, csvFilename, escapeCsvCell } from '../../src/lib/csv.js';

describe('formula injection guard', () => {
  it('prefixes a leading equals sign', () => {
    expect(escapeCsvCell('=1+1')).toBe("'=1+1");
  });

  it('prefixes a leading plus, minus and at sign', () => {
    expect(escapeCsvCell('+1')).toBe("'+1");
    expect(escapeCsvCell('-1')).toBe("'-1");
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('prefixes a leading tab, which needs no quoting of its own', () => {
    expect(escapeCsvCell('\tvalue')).toBe("'\tvalue");
  });

  it('prefixes and quotes a leading carriage return', () => {
    expect(escapeCsvCell('\rvalue')).toBe('"\'\rvalue"');
  });

  it('guards the classic DDE payload', () => {
    const cell = escapeCsvCell('=cmd|\' /C calc\'!A0');
    expect(cell.startsWith('"\'=') || cell.startsWith("'=")).toBe(true);
  });

  it('leaves ordinary text alone', () => {
    expect(escapeCsvCell('Acme Traders')).toBe('Acme Traders');
    expect(escapeCsvCell(42)).toBe('42');
    expect(escapeCsvCell(true)).toBe('true');
  });

  it('renders null and undefined as an empty cell', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });
});

describe('quoting', () => {
  it('quotes a value containing a comma', () => {
    expect(escapeCsvCell('Mumbai, Maharashtra')).toBe('"Mumbai, Maharashtra"');
  });

  it('doubles embedded quotes', () => {
    expect(escapeCsvCell('He said "hello"')).toBe('"He said ""hello"""');
  });

  it('quotes a value containing a newline', () => {
    expect(escapeCsvCell('line one\nline two')).toBe('"line one\nline two"');
  });
});

describe('buildCsv', () => {
  it('writes a header row and CRLF line endings', () => {
    const csv = buildCsv([{ name: 'Acme', city: 'Pune' }], [
      { header: 'Name', value: (row) => row.name },
      { header: 'City', value: (row) => row.city },
    ]);
    expect(csv).toBe('Name,City\r\nAcme,Pune\r\n');
  });

  it('writes only a header row for an empty set', () => {
    const csv = buildCsv<{ name: string }>([], [{ header: 'Name', value: (row) => row.name }]);
    expect(csv).toBe('Name\r\n');
  });

  it('escapes a hostile client name in a real row', () => {
    const csv = buildCsv([{ name: '=HYPERLINK("http://evil.test")' }], [
      { header: 'Name', value: (row) => row.name },
    ]);
    expect(csv).toContain('"\'=HYPERLINK(""http://evil.test"")"');
  });
});

describe('csvFilename', () => {
  it('stamps the date and keeps the name filesystem safe', () => {
    expect(csvFilename('FirmDesk Clients', new Date('2026-07-29T10:00:00Z'))).toBe(
      'firmdesk-clients-2026-07-29.csv',
    );
  });
});
