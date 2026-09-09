/**
 * Tally XML protocol engine.
 *
 * Builds and parses the <ENVELOPE> documents that Tally ERP 9 / TallyPrime
 * exchange over their built-in HTTP server (default localhost:9000). Pure
 * functions only — no network, no DB — so the wire format is exhaustively
 * unit-testable and the desktop bridge stays thin.
 *
 * Money rules in Tally's XML:
 *  - <AMOUNT> is a plain number in rupees, no symbol, 2 decimals.
 *  - Sign carries the entry side *per Tally's* convention: DEBIT entries are
 *    NEGATIVE, CREDIT entries are POSITIVE (Tally deems debits "positive"
 *    flows outwards, hence ISDEEMEDPOSITIVE=Yes marks a debit line).
 *  - <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE> + negative AMOUNT  => DEBIT.
 *    <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>  + positive AMOUNT  => CREDIT.
 *
 * One-way rule enforced here by construction: this module only ever builds
 * Import (post) and Export (read) requests; there is no sync-back path.
 */

import type { VoucherType } from './enums.js';

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export interface TallyLedgerEntry {
  ledgerName: string;
  isDebit: boolean;
  /** Integer paise. Converted to signed rupees on the wire. */
  paise: number;
}

export interface TallyVoucher {
  /** Voucher date as YYYY-MM-DD (converted to Tally's YYYYMMDD on the wire). */
  date: string;
  type: VoucherType;
  narration: string | null;
  reference: string | null;
  /** FirmDesk voucher id — written as a voucher-level field for idempotency matching. */
  firmdeskId: string;
  firmdeskVoucherNo: string | null;
  entries: TallyLedgerEntry[];
}

export interface TallyAccountMaster {
  name: string;
  parent: string | null;
  isBillWise: boolean;
  openingPaise: number;
  openingIsDebit: boolean;
}

export interface TallyCompanyConfig {
  companyName: string;
}

// ---------------------------------------------------------------------------
// XML helpers (no dependencies — Tally rejects anything fancy anyway)
// ---------------------------------------------------------------------------

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** Integer paise -> Tally rupee string with the correct sign for the side. */
export const paiseToTallyAmount = (paise: number, isDebit: boolean): string => {
  const rupees = (paise / 100).toFixed(2);
  // Tally's convention: debits are negative, credits positive.
  return isDebit && paise > 0 ? `-${rupees}` : rupees;
};

/** '2026-09-05' -> '20260905'. */
export const dateToTallyFormat = (iso: string): string => iso.replace(/-/g, '');

const VTYPE_MAP: Record<VoucherType, string> = {
  journal: 'Journal',
  sales: 'Sales',
  purchase: 'Purchase',
  payment: 'Payment',
  receipt: 'Receipt',
  contra: 'Contra',
  debit_note: 'Credit Note', // Tally uses a single Credit Note class for both
  credit_note: 'Credit Note',
};

export const tallyVoucherClass = (type: VoucherType): string => VTYPE_MAP[type];

// ---------------------------------------------------------------------------
// Request builders
// ---------------------------------------------------------------------------

const envelope = (request: string, body: string): string =>
  `<ENVELOPE><HEADER><TALLYREQUEST>${request}</TALLYREQUEST></HEADER><BODY>${body}</BODY></ENVELOPE>`;

/** Posts (imports) vouchers. Multiple vouchers ride in one envelope. */
export const buildVoucherImportRequest = (
  company: TallyCompanyConfig,
  vouchers: readonly TallyVoucher[],
): string => {
  const messages = vouchers
    .map((voucher) => {
      const lines = voucher.entries
        .map((entry) => {
          const amount = paiseToTallyAmount(entry.paise, entry.isDebit);
          const deemed = entry.isDebit ? 'Yes' : 'No';
          return `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${escapeXml(
            entry.ledgerName,
          )}</LEDGERNAME><ISDEEMEDPOSITIVE>${deemed}</ISDEEMEDPOSITIVE><AMOUNT>${amount}</AMOUNT></ALLLEDGERENTRIES.LIST>`;
        })
        .join('');
      return `<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VTYPE="${escapeXml(
        tallyVoucherClass(voucher.type),
      )}" ACTION="Create" OBJVIEW="Accounting Voucher View"><DATE>${dateToTallyFormat(
        voucher.date,
      )}</DATE><NARRATION>${escapeXml(
        voucher.narration ?? '',
      )}</NARRATION><REFERENCE>${escapeXml(
        voucher.reference ?? '',
      )}</REFERENCE><VOUCHERTYPENAME>${escapeXml(
        tallyVoucherClass(voucher.type),
      )}</VOUCHERTYPENAME><VCHENTRYMODE>Item Invoice</VCHENTRYMODE>${lines}<UDF:FIRMDESKVID.LIST DESC="FirmDeskVoucherId" ISLIST="YES" TYPE="String">${escapeXml(
        voucher.firmdeskId,
      )}</UDF:FIRMDESKVID.LIST><UDF:FIRMDESKVNO.LIST DESC="FirmDeskVoucherNo" ISLIST="YES" TYPE="String">${escapeXml(
        voucher.firmdeskVoucherNo ?? '',
      )}</UDF:FIRMDESKVNO.LIST></VOUCHER></TALLYMESSAGE>`;
    })
    .join('');

  return envelope(
    'Import Data',
    `<IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${escapeXml(
      company.companyName,
    )}</SVCURRENTCOMPANY><SVEXPORTFORMAT>$$SrvXML</SVEXPORTFORMAT></STATICVARIABLES></REQUESTDESC><REQUESTDATA>${messages}</REQUESTDATA></IMPORTDATA>`,
  );
};

/** Lightweight ping: asks Tally for the current company — proves reachability. */
export const buildCompanyPingRequest = (): string =>
  envelope(
    'Export Data',
    `<EXPORTDATA><REQUESTDESC><REPORTNAME>My Company</REPORTNAME><STATICVARIABLES><SVEXPORTFORMAT>$$SrvXML</SVEXPORTFORMAT></STATICVARIABLES></REQUESTDESC></EXPORTDATA>`,
  );

/** Requests the full ledger master list for read-only import. */
export const buildLedgerListRequest = (company: TallyCompanyConfig): string =>
  envelope(
    'Export Data',
    `<EXPORTDATA><REQUESTDESC><REPORTNAME>List of Accounts</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${escapeXml(
      company.companyName,
    )}</SVCURRENTCOMPANY><SVEXPORTFORMAT>$$SrvXML</SVEXPORTFORMAT><ACCOUNTTYPE>Ledgers</ACCOUNTTYPE></STATICVARIABLES></REQUESTDESC></EXPORTDATA>`,
  );

/** Requests the trial balance — carries each ledger's opening/closing amount. */
export const buildTrialBalanceRequest = (company: TallyCompanyConfig): string =>
  envelope(
    'Export Data',
    `<EXPORTDATA><REQUESTDESC><REPORTNAME>Trial Balance</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${escapeXml(
      company.companyName,
    )}</SVCURRENTCOMPANY><SVEXPORTFORMAT>$$SrvXML</SVEXPORTFORMAT></STATICVARIABLES></REQUESTDESC></EXPORTDATA>`,
  );

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

const text = (source: string, tagName: string): string | null => {
  const match = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i').exec(source);
  if (!match) return null;
  return match[1]?.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') ?? null;
};

export interface TallyImportResult {
  ok: boolean;
  /** Number of vouchers Tally actually imported. */
  created: number;
  /** Number of vouchers Tally skipped as already existing (idempotent re-post). */
  alreadyExists: number;
  /** Tally-side error text, if any. */
  error: string | null;
  /** Raw body trimmed — logged for evidence. */
  raw: string;
}

/**
 * Parses Tally's import response. On success Tally returns LINEERROR-free
 * IMPORT status; re-importing a voucher that already exists reports
 * "Duplicate Entry" / already-exists phrasing which we treat as success
 * (idempotency), because the FirmDesk voucher id is embedded in every post.
 */
export const parseImportResponse = (body: string): TallyImportResult => {
  const upper = body.toUpperCase();
  const hasFatal = upper.includes('<LINEERROR>') || upper.includes('FAILED');
  const createdMatch = /<CREATED>(\d+)<\/CREATED>/i.exec(body);
  const alteredMatch = /<ALTERED>(\d+)<\/ALTERED>/i.exec(body);
  const alreadyExists = /DUPLICATE|ALREADY EXIST/i.test(body);
  const errorText =
    text(body, 'LINEERROR') ??
    (hasFatal ? (text(body, 'ERROR') ?? body.slice(0, 500)) : null);

  if (hasFatal && !alreadyExists) {
    return {
      ok: false,
      created: 0,
      alreadyExists: 0,
      error: errorText ?? 'Tally reported a failure without detail.',
      raw: body.trim().slice(0, 2000),
    };
  }
  const created = createdMatch ? Number(createdMatch[1]) : alteredMatch ? Number(alteredMatch[1]) : 1;
  return {
    ok: true,
    created: alreadyExists ? 0 : created,
    alreadyExists: alreadyExists ? 1 : 0,
    error: null,
    raw: body.trim().slice(0, 2000),
  };
};

export interface TallyCompanyStatus {
  reachable: boolean;
  /** Company name Tally reports as open, null when not reachable/none. */
  companyName: string | null;
  /** True when Tally runs in education mode (1st/2nd-of-month vouchers only). */
  educationMode: boolean;
  version: string | null;
  error: string | null;
}

export const parseCompanyPingResponse = (body: string): TallyCompanyStatus => {
  const companyName =
    text(body, 'NAME') ??
    text(body, 'COMPANYNAME') ??
    text(body, 'SVCURRENTCOMPANY');
  if (companyName === null) {
    return {
      reachable: false,
      companyName: null,
      educationMode: false,
      version: text(body, 'VERSION'),
      error: 'Tally did not report an open company.',
    };
  }
  return {
    reachable: true,
    companyName,
    educationMode: /EDUCATION/i.test(body),
    version: text(body, 'VERSION'),
    error: null,
  };
};

export interface ImportedLedger {
  name: string;
  parent: string | null;
  /** Positive paise; side carried separately. */
  openingPaise: number;
  openingIsDebit: boolean;
  isBillWise: boolean;
}

/** Parses rupees like "-1,23,456.00" into signed paise. */
export const tallyAmountToPaise = (raw: string | null): number | null => {
  if (raw === null || raw.trim().length === 0) return null;
  const cleaned = raw.replace(/[, ]/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const negative = cleaned.startsWith('-');
  const [whole, fraction = ''] = cleaned.replace('-', '').split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return negative ? -paise : paise;
};

/**
 * Parses Tally's "List of Accounts" export into ledger rows. Tally's actual
 * report XML nests ledgers as <LEDGER>...<NAME>..</NAME><OPENINGBALANCE>..
 * and groups under <GROUP>; the parser tolerates both flat and nested shapes
 * because ERP 9 and TallyPrime render slightly differently.
 */
export const parseLedgerListResponse = (body: string): ImportedLedger[] => {
  const blocks = body.split(/<LEDGER[\s>]/i).slice(1);
  const out: ImportedLedger[] = [];
  for (const block of blocks) {
    const name = text(block, 'NAME');
    if (!name) continue;
    const parent = text(block, 'PARENT');
    const openingRaw = text(block, 'OPENINGBALANCE');
    const opening = tallyAmountToPaise(openingRaw) ?? 0;
    out.push({
      name,
      parent,
      openingPaise: Math.abs(opening),
      openingIsDebit: opening <= 0, // Tally sign convention: negative = debit
      isBillWise: /<ISBILLWISEON>\s*Yes\s*<\/ISBILLWISEON>/i.test(block),
    });
  }
  return out;
};
