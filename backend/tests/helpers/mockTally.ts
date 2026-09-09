import { describe, expect, it } from 'vitest';

import { buildCompanyPingRequest, buildLedgerListRequest } from '../../src/lib/tally.js';
import { parseCompanyPingResponse, parseLedgerListResponse } from '../../src/lib/tally.js';

/**
 * Mock of Tally's localhost:9000 XML server, speaking the real envelope
 * protocol. Used by the desktop bridge integration tests so the whole
 * cloud -> desktop -> Tally loop is deterministic in CI.
 *
 * This is a test-side *emulation* of the relay logic, not an import of
 * production code: the desktop agent's relay (send payload.requestXml,
 * parse, report) is mirrored by `relay` below.
 */

export interface MockTallyState {
  companyOpen: boolean;
  companyName: string;
  educationMode: boolean;
  /** Ledger names Tally knows; posting to an unknown ledger fails. */
  ledgers: string[];
  /** Voucher XML bodies received, for assertions. */
  receivedVouchers: string[];
  /** When set, imports fail with this LINEERROR text. */
  importError: string | null;
}

export const makeTallyState = (overrides: Partial<MockTallyState> = {}): MockTallyState => ({
  companyOpen: true,
  companyName: 'Sharma Traders',
  educationMode: false,
  ledgers: ['Sharma Traders', 'Sales', 'GST Output Tax', 'Cash', 'Sundry Debtors', 'Purchase'],
  receivedVouchers: [],
  importError: null,
  ...overrides,
});

/** Emulates Tally answering an Export Data ping. */
export const tallyPingReply = (state: MockTallyState): string => {
  if (!state.companyOpen) {
    return '<ENVELOPE><BODY><DATA></DATA></BODY></ENVELOPE>';
  }
  return `<ENVELOPE><BODY><DATA><COLLECTION><COMPANY><NAME>${state.companyName}</NAME><VERSION>2.1.3</VERSION>${
    state.educationMode ? '<LICENSE>Education Mode</LICENSE>' : '<LICENSE>Full</LICENSE>'
  }</COMPANY></COLLECTION></DATA></BODY></ENVELOPE>`;
};

/** Emulates Tally answering the List of Accounts export. */
export const tallyLedgerListReply = (state: MockTallyState): string => {
  const blocks = state.ledgers
    .map(
      (name) =>
        `<LEDGER NAME="${name}"><NAME>${name}</NAME><PARENT>${
          name === 'Sales' ? 'Sales Accounts' : 'Sundry Debtors'
        }</PARENT><OPENINGBALANCE>${
          name === 'Cash' ? '-25000.00' : name === 'Sales' ? '' : '-1,18,000.00'
        }</OPENINGBALANCE><ISBILLWISEON>${name === 'Sharma Traders' ? 'Yes' : 'No'}</ISBILLWISEON></LEDGER>`,
    )
    .join('');
  return `<ENVELOPE><BODY><DATA><COLLECTION>${blocks}</COLLECTION></DATA></BODY></ENVELOPE>`;
};

/** Emulates Tally answering a Vouchers Import (post). */
export const tallyImportReply = (state: MockTallyState, requestXml: string): string => {
  state.receivedVouchers.push(requestXml);
  if (state.importError !== null) {
    return `<ENVELOPE><BODY><DATA><LINEERROR>${state.importError}</LINEERROR></DATA></BODY></ENVELOPE>`;
  }
  // Any ledger name referenced in the XML but unknown to Tally fails.
  for (const match of requestXml.matchAll(/<LEDGERNAME>([\s\S]*?)<\/LEDGERNAME>/g)) {
    const name = (match[1] ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    if (!state.ledgers.includes(name)) {
      return `<ENVELOPE><BODY><DATA><LINEERROR>Ledger '${name}' does not exist</LINEERROR></DATA></BODY></ENVELOPE>`;
    }
  }
  const count = (requestXml.match(/<TALLYMESSAGE/g) ?? []).length;
  return `<ENVELOPE><HEADER><STATUS>1</STATUS></HEADER><BODY><DATA><IMPORTRESULT><CREATED>${count}</CREATED><ALTERED>0</ALTERED><ERRORS>0</ERRORS></IMPORTRESULT></DATA></BODY></ENVELOPE>`;
};

/**
 * Mirrors the desktop agent's relay step: takes the command payload the API
 * hands out and produces the result detail the agent would report back.
 */
export const relay = (
  state: MockTallyState,
  payload: { requestXml: string },
): { ok: boolean; detail: Record<string, unknown>; error?: string } => {
  const xml = payload.requestXml;
  if (xml.includes('<TALLYREQUEST>Import Data</TALLYREQUEST>')) {
    const reply = tallyImportReply(state, xml);
    const ok = !reply.includes('<LINEERROR>');
    const lineError = /<LINEERROR>([\s\S]*?)<\/LINEERROR>/.exec(reply)?.[1] ?? null;
    return {
      ok,
      detail: { imported: (xml.match(/<TALLYMESSAGE/g) ?? []).length, reply: reply.slice(0, 300) },
      ...(ok ? {} : { error: lineError ?? 'Tally rejected the import' }),
    };
  }
  if (xml.includes('List of Accounts')) {
    const reply = tallyLedgerListReply(state);
    const ledgers = parseLedgerListResponse(reply);
    return { ok: true, detail: { ledgers } };
  }
  const reply = tallyPingReply(state);
  const status = parseCompanyPingResponse(reply);
  return {
    ok: status.reachable,
    detail: { ...status, probe: buildCompanyPingRequest().length > 0 },
    ...(status.reachable ? {} : { error: 'Tally did not report an open company' }),
  };
};

describe('mock tally fixture sanity', () => {
  it('answers a ping with the open company', () => {
    const state = makeTallyState();
    const status = parseCompanyPingResponse(tallyPingReply(state));
    expect(status).toMatchObject({ reachable: true, companyName: 'Sharma Traders' });
  });

  it('flags education mode', () => {
    const state = makeTallyState({ educationMode: true });
    expect(parseCompanyPingResponse(tallyPingReply(state)).educationMode).toBe(true);
  });

  it('reports unreachable when no company is open', () => {
    const state = makeTallyState({ companyOpen: false });
    expect(parseCompanyPingResponse(tallyPingReply(state)).reachable).toBe(false);
  });

  it('exports the ledger list', () => {
    const state = makeTallyState();
    const ledgers = parseLedgerListResponse(tallyLedgerListReply(state));
    expect(ledgers.map((ledger) => ledger.name)).toContain('Sales');
  });

  it('relays a post through the whole import cycle', () => {
    const state = makeTallyState();
    const result = relay(state, {
      requestXml:
        '<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDATA><TALLYMESSAGE><VOUCHER></VOUCHER></TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>',
    });
    expect(result.ok).toBe(true);
    expect(result.detail.imported).toBe(1);
  });
});

describe('mock tally ledger request shape', () => {
  it('matches the List of Accounts report the relay recognises', () => {
    const state = makeTallyState();
    const request = buildLedgerListRequest({ companyName: state.companyName });
    expect(request).toContain('List of Accounts');
    expect(relay(state, { requestXml: request }).ok).toBe(true);
  });
});
