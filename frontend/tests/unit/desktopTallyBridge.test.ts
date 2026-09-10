import { describe, expect, it } from 'vitest';

import { interpretReply } from '@/hooks/useWorkstationAgent';
import { isDesktop } from '@/lib/shell';

/**
 * Deterministic desktop-bridge tests against the mock Tally envelope
 * protocol (spec §9.3) — the same fixtures the backend harness uses:
 * success, LINEERROR, duplicate (idempotent), education mode, offline.
 * No real Tally in CI; the Rust relay is exercised in the manual smoke.
 */

const PING_REPLY = (company: string, education: boolean): string =>
  `<ENVELOPE><BODY><DATA><COLLECTION><COMPANY><NAME>${company}</NAME><VERSION>2.1.3</VERSION>${
    education ? '<LICENSE>Education Mode</LICENSE>' : '<LICENSE>Full</LICENSE>'
  }</LICENSE></COMPANY></COLLECTION></DATA></BODY></ENVELOPE>`;

const IMPORT_OK = (created: number): string =>
  `<ENVELOPE><HEADER><STATUS>1</STATUS></HEADER><BODY><DATA><IMPORTRESULT><CREATED>${created}</CREATED><ALTERED>0</ALTERED><ERRORS>0</ERRORS></IMPORTRESULT></DATA></BODY></ENVELOPE>`;

const IMPORT_LINE_ERROR = (message: string): string =>
  `<ENVELOPE><BODY><DATA><LINEERROR>${message}</LINEERROR></DATA></BODY></ENVELOPE>`;

const IMPORT_DUPLICATE: string =
  '<ENVELOPE><BODY><DATA><LINEERROR>Duplicate Entry</LINEERROR></DATA></BODY></ENVELOPE>';

const LEDGER_LIST = (ledgers: string[]): string =>
  `<ENVELOPE><BODY><DATA><COLLECTION>${ledgers
    .map(
      (name) =>
        `<LEDGER NAME="${name}"><NAME>${name}</NAME><PARENT>Sundry Debtors</PARENT><OPENINGBALANCE>-1,18,000.00</OPENINGBALANCE><ISBILLWISEON>No</ISBILLWISEON></LEDGER>`,
    )
    .join('')}</COLLECTION></DATA></BODY></ENVELOPE>`;

describe('tally_post interpretation', () => {
  it('reports a clean import with the CREATED count', () => {
    const result = interpretReply('tally_post', IMPORT_OK(2));
    expect(result.ok).toBe(true);
    expect(result.detail).toMatchObject({ created: 2, alreadyExists: false });
  });

  it('fails honestly on a LINEERROR', () => {
    const result = interpretReply('tally_post', IMPORT_LINE_ERROR("Ledger 'Sharma Traders' does not exist"));
    expect(result.ok).toBe(false);
    expect(result.error).toContain('does not exist');
  });

  it('treats a duplicate as idempotent success', () => {
    const result = interpretReply('tally_post', IMPORT_DUPLICATE);
    expect(result.ok).toBe(true);
    expect(result.detail).toMatchObject({ alreadyExists: true });
  });
});

describe('tally_import interpretation', () => {
  it('parses ledger rows with Indian-format opening balances into paise', () => {
    const result = interpretReply('tally_import', LEDGER_LIST(['Sharma Traders', 'Sales']));
    expect(result.ok).toBe(true);
    const ledgers = result.detail.ledgers as Array<{ name: string; openingPaise: number; openingIsDebit: boolean }>;
    expect(ledgers).toHaveLength(2);
    // "-1,18,000.00" -> 11800000 paise, negative = debit
    expect(ledgers[0]).toMatchObject({ name: 'Sharma Traders', openingPaise: 118_000_00, openingIsDebit: true });
  });

  it('fails when Tally refuses the export', () => {
    const result = interpretReply('tally_import', IMPORT_LINE_ERROR('Company not open'));
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Company not open');
  });
});

describe('tally_health interpretation', () => {
  it('reports the open company and education mode', () => {
    const result = interpretReply('tally_health', PING_REPLY('Sharma Traders', true));
    expect(result.ok).toBe(true);
    expect(result.detail).toMatchObject({
      reachable: true,
      companyName: 'Sharma Traders',
      educationMode: true,
    });
  });

  it('reports unreachable when no company is open', () => {
    const result = interpretReply('tally_health', '<ENVELOPE><BODY><DATA></DATA></BODY></ENVELOPE>');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Tally did not report an open company.');
  });
});

describe('one-way rule', () => {
  it('never emits a sync-back path from any interpretation', () => {
    for (const type of ['tally_post', 'tally_import', 'tally_health']) {
      const result = interpretReply(type, IMPORT_OK(1));
      expect(JSON.stringify(result)).not.toMatch(/sync|pull.*voucher|write.*firmdesk/i);
    }
  });
});

describe('shell guard', () => {
  it('runs the interpretation in the current shell without bridge access', () => {
    // Interpretation is pure: it must work in either shell without __TAURI__.
    expect(typeof interpretReply('tally_health', PING_REPLY('X', false))).toBe('object');
    void isDesktop;
  });
});
