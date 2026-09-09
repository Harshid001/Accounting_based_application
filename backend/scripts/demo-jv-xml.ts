/**
 * Demo run: prints the exact XML the generator produces for a sample 3-line JV.
 * Execute with: npx tsx scripts/demo-jv-xml.ts  (from backend/)
 */
import {
  buildVoucherImportRequest,
  parseImportResponse,
} from '../src/lib/tally.js';
import type { TallyVoucher } from '../src/lib/tally.js';

const voucher: TallyVoucher = {
  date: '2026-09-10',
  type: 'journal',
  narration: 'Rent for September 2026 & maintenance charge',
  reference: 'JV/2026-27/00042',
  firmdeskId: '66e0a1b2c3d4e5f6a7b8c9d1',
  firmdeskVoucherNo: 'JV/2026-27/00042',
  entries: [
    { ledgerName: 'Rent Expense', isDebit: true, paise: 1_500_000 }, // Dr 15,000.00
    { ledgerName: 'Repairs & Maintenance', isDebit: true, paise: 250_000 }, // Dr  2,500.00
    { ledgerName: 'HDFC Bank Current A/c', isDebit: false, paise: 1_750_000 }, // Cr 17,500.00
  ],
};

const xml = buildVoucherImportRequest({ companyName: 'Sharma & Sons Traders' }, [voucher]);

const pretty = xml.replace(/></g, '>\n<');

console.log(pretty);
console.log('\n--- Import response parse check ---');
console.log(
  JSON.stringify(
    parseImportResponse(
      '<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Import Data</TALLYREQUEST><STATUS>1</STATUS></HEADER><BODY><DATA><IMPORTRESULT><CREATED>1</CREATED><ALTERED>0</ALTERED><ERRORS>0</ERRORS></IMPORTRESULT></DATA></BODY></ENVELOPE>',
    ),
    null,
    2,
  ),
);
