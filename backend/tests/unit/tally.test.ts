import { describe, expect, it } from 'vitest';

import {
  buildCompanyPingRequest,
  buildLedgerListRequest,
  buildVoucherImportRequest,
  dateToTallyFormat,
  paiseToTallyAmount,
  parseCompanyPingResponse,
  parseImportResponse,
  parseLedgerListResponse,
  tallyAmountToPaise,
  tallyVoucherClass,
} from '../../src/lib/tally.js';
import type { TallyVoucher } from '../../src/lib/tally.js';

const COMPANY = { companyName: 'Sharma & Sons <Traders>' };

const salesVoucher: TallyVoucher = {
  date: '2026-09-05',
  type: 'sales',
  narration: 'Invoice INV-001 "rush" & urgent',
  reference: 'INV-001',
  firmdeskId: '66e0a1b2c3d4e5f6a7b8c9d0',
  firmdeskVoucherNo: 'JV/2026-27/00001',
  entries: [
    { ledgerName: 'Sharma Traders', isDebit: true, paise: 118_000 },
    { ledgerName: 'Sales', isDebit: false, paise: 100_000 },
    { ledgerName: 'GST Output Tax', isDebit: false, paise: 18_000 },
  ],
};

describe('tally amount + date formatting', () => {
  it('writes debits as negative rupees and credits as positive', () => {
    expect(paiseToTallyAmount(118_000, true)).toBe('-1180.00');
    expect(paiseToTallyAmount(118_000, false)).toBe('1180.00');
    expect(paiseToTallyAmount(5, true)).toBe('-0.05');
    expect(paiseToTallyAmount(0, true)).toBe('0.00');
  });

  it('converts ISO dates to YYYYMMDD', () => {
    expect(dateToTallyFormat('2026-09-05')).toBe('20260905');
  });

  it('parses Tally rupee strings (with Indian grouping) into signed paise', () => {
    expect(tallyAmountToPaise('-1,23,456.00')).toBe(-12_345_600);
    expect(tallyAmountToPaise('1180.5')).toBe(118_050);
    expect(tallyAmountToPaise('')).toBeNull();
    expect(tallyAmountToPaise('abc')).toBeNull();
  });

  it('maps voucher types to Tally classes', () => {
    expect(tallyVoucherClass('journal')).toBe('Journal');
    expect(tallyVoucherClass('credit_note')).toBe('Credit Note');
    expect(tallyVoucherClass('payment')).toBe('Payment');
  });
});

describe('buildVoucherImportRequest', () => {
  const xml = buildVoucherImportRequest(COMPANY, [salesVoucher]);

  it('uses the Import Data envelope and targets the company', () => {
    expect(xml.startsWith('<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST>')).toBe(
      true,
    );
    expect(xml).toContain('<REPORTNAME>Vouchers</REPORTNAME>');
    expect(xml).toContain('<SVCURRENTCOMPANY>Sharma &amp; Sons &lt;Traders&gt;</SVCURRENTCOMPANY>');
  });

  it('marks debit lines ISDEEMEDPOSITIVE=Yes with NEGATIVE amounts', () => {
    expect(xml).toContain(
      '<LEDGERNAME>Sharma Traders</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-1180.00</AMOUNT>',
    );
  });

  it('marks credit lines ISDEEMEDPOSITIVE=No with POSITIVE amounts', () => {
    expect(xml).toContain(
      '<LEDGERNAME>Sales</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>1000.00</AMOUNT>',
    );
    expect(xml).toContain(
      '<LEDGERNAME>GST Output Tax</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>180.00</AMOUNT>',
    );
  });

  it('nets to zero in Tally sign terms', () => {
    const amounts = [...xml.matchAll(/<AMOUNT>(-?[\d.]+)<\/AMOUNT>/g)].map((m) => Number(m[1]));
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBeCloseTo(0, 2);
  });

  it('writes the voucher class, date, narration and escapes XML', () => {
    expect(xml).toContain('<VOUCHER VTYPE="Sales" ACTION="Create"');
    expect(xml).toContain('<VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>');
    expect(xml).toContain('<DATE>20260905</DATE>');
    expect(xml).toContain('<NARRATION>Invoice INV-001 &quot;rush&quot; &amp; urgent</NARRATION>');
    expect(xml).toContain('<REFERENCE>INV-001</REFERENCE>');
  });

  it('embeds the FirmDesk voucher id for idempotency', () => {
    expect(xml).toContain('66e0a1b2c3d4e5f6a7b8c9d0</UDF:FIRMDESKVID.LIST>');
    expect(xml).toContain('JV/2026-27/00001</UDF:FIRMDESKVNO.LIST>');
  });

  it('batches multiple vouchers in one envelope', () => {
    const two = buildVoucherImportRequest(COMPANY, [salesVoucher, { ...salesVoucher, type: 'journal' }]);
    expect((two.match(/<TALLYMESSAGE/g) ?? []).length).toBe(2);
  });
});

describe('read-only request builders', () => {
  it('never emit Import Data (one-way rule by construction)', () => {
    expect(buildCompanyPingRequest()).toContain('<TALLYREQUEST>Export Data</TALLYREQUEST>');
    expect(buildLedgerListRequest(COMPANY)).toContain('<TALLYREQUEST>Export Data</TALLYREQUEST>');
    expect(buildLedgerListRequest(COMPANY)).toContain('<REPORTNAME>List of Accounts</REPORTNAME>');
    expect(buildLedgerListRequest(COMPANY)).not.toContain('Import');
  });
});

describe('parseImportResponse', () => {
  it('treats a clean response as success', () => {
    const result = parseImportResponse(
      '<ENVELOPE><HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER><BODY><DATA><IMPORTRESULT><CREATED>1</CREATED><ALTERED>0</ALTERED><ERRORS>0</ERRORS></IMPORTRESULT></DATA></BODY></ENVELOPE>',
    );
    expect(result.ok).toBe(true);
    expect(result.created).toBe(1);
    expect(result.error).toBeNull();
  });

  it('surfaces LINEERROR text as a failure', () => {
    const result = parseImportResponse(
      '<ENVELOPE><BODY><DATA><LINEERROR>Ledger &apos;Sales&apos; does not exist!</LINEERROR></DATA></BODY></ENVELOPE>',
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain('does not exist');
  });

  it('treats duplicate/already-exists as an idempotent success', () => {
    const result = parseImportResponse(
      '<ENVELOPE><BODY><DATA><LINEERROR>Duplicate Entry: voucher already exists</LINEERROR></DATA></BODY></ENVELOPE>',
    );
    expect(result.ok).toBe(true);
    expect(result.alreadyExists).toBe(1);
    expect(result.created).toBe(0);
  });
});

describe('parseCompanyPingResponse', () => {
  it('reads the open company name and detects education mode', () => {
    const status = parseCompanyPingResponse(
      '<ENVELOPE><BODY><DATA><COLLECTION><COMPANY><NAME>Sharma Traders</NAME><VERSION>6.6.3</VERSION><LICENSE>Education Mode</LICENSE></COMPANY></COLLECTION></DATA></BODY></ENVELOPE>',
    );
    expect(status.reachable).toBe(true);
    expect(status.companyName).toBe('Sharma Traders');
    expect(status.educationMode).toBe(true);
    expect(status.version).toBe('6.6.3');
  });

  it('reports no company when the body is empty', () => {
    const status = parseCompanyPingResponse('<ENVELOPE><BODY><DATA></DATA></BODY></ENVELOPE>');
    expect(status.reachable).toBe(false);
    expect(status.companyName).toBeNull();
  });
});

describe('parseLedgerListResponse', () => {
  it('extracts ledgers with parent group and opening balance (Tally sign: negative = Dr)', () => {
    const body = `<ENVELOPE><BODY><DATA><COLLECTION>
      <LEDGER NAME="Cash" RESERVEDNAME=""><NAME>Cash</NAME><PARENT>Cash-in-Hand</PARENT><OPENINGBALANCE>-25000.00</OPENINGBALANCE><ISBILLWISEON>No</ISBILLWISEON></LEDGER>
      <LEDGER NAME="Sharma Traders"><NAME>Sharma Traders</NAME><PARENT>Sundry Debtors</PARENT><OPENINGBALANCE>-1,18,000.00</OPENINGBALANCE><ISBILLWISEON>Yes</ISBILLWISEON></LEDGER>
      <LEDGER NAME="Sales"><NAME>Sales</NAME><PARENT>Sales Accounts</PARENT><OPENINGBALANCE></OPENINGBALANCE></LEDGER>
      <LEDGER NAME="Capital"><NAME>Capital</NAME><PARENT>Capital Account</PARENT><OPENINGBALANCE>500000.00</OPENINGBALANCE></LEDGER>
    </COLLECTION></DATA></BODY></ENVELOPE>`;
    const ledgers = parseLedgerListResponse(body);
    expect(ledgers).toHaveLength(4);
    expect(ledgers[0]).toMatchObject({
      name: 'Cash',
      parent: 'Cash-in-Hand',
      openingPaise: 2_500_000,
      openingIsDebit: true,
      isBillWise: false,
    });
    expect(ledgers[1]).toMatchObject({ openingPaise: 11_800_000, openingIsDebit: true, isBillWise: true });
    expect(ledgers[2]).toMatchObject({ openingPaise: 0 });
    expect(ledgers[3]).toMatchObject({ openingPaise: 50_000_000, openingIsDebit: false });
  });

  it('returns nothing for an empty export', () => {
    expect(parseLedgerListResponse('<ENVELOPE><BODY><DATA/></BODY></ENVELOPE>')).toEqual([]);
  });
});
