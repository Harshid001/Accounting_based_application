import { describe, expect, it } from 'vitest';

import {
  applyRatePct,
  formatVoucherNo,
  fyLabelFor,
  lockCovering,
  materialiseVoucher,
  naturalBalance,
  resolveLockPeriod,
  reversalLines,
  rupeesToPaise,
  signedNaturalBalance,
} from '../../src/lib/books.js';
import type { AccountInfo, LineInput, SystemAccountMap } from '../../src/lib/books.js';
import { utcMidnight } from '../../src/lib/date.js';
import { AppError } from '../../src/lib/errors.js';

const SYSTEM: SystemAccountMap = {
  gst_output: 'sys-gst-out',
  gst_input: 'sys-gst-in',
  tds_payable: 'sys-tds-pay',
  tds_receivable: 'sys-tds-rec',
  rounding: 'sys-round',
};

const account = (
  id: string,
  type: AccountInfo['type'],
  overrides: Partial<AccountInfo> = {},
): AccountInfo => ({
  id,
  name: id,
  type,
  subType: null,
  isActive: true,
  isSystemDuty: false,
  ...overrides,
});

const ACCOUNTS = new Map<string, AccountInfo>(
  [
    account('cash', 'asset'),
    account('bank', 'asset'),
    account('debtor', 'asset'),
    account('creditor', 'liability'),
    account('sales', 'income'),
    account('rent', 'expense'),
    account('purchases', 'expense'),
    account('inactive', 'expense', { isActive: false }),
    account('sys-gst-out', 'liability', { isSystemDuty: true }),
    account('sys-gst-in', 'asset', { isSystemDuty: true }),
    account('sys-tds-pay', 'liability', { isSystemDuty: true }),
    account('sys-tds-rec', 'asset', { isSystemDuty: true }),
    account('sys-round', 'expense', { isSystemDuty: true }),
  ].map((entry) => [entry.id, entry] as const),
);

const dr = (accountId: string, paise: number, extra: Partial<LineInput> = {}): LineInput => ({
  accountId,
  debitPaise: paise,
  creditPaise: 0,
  ...extra,
});
const cr = (accountId: string, paise: number, extra: Partial<LineInput> = {}): LineInput => ({
  accountId,
  debitPaise: 0,
  creditPaise: paise,
  ...extra,
});

const expectValidation = (fn: () => unknown, fragment: string): void => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('VALIDATION_FAILED');
    const details =
      JSON.stringify((error as AppError).details ?? []) + (error as AppError).message;
    expect(details).toContain(fragment);
    return;
  }
  throw new Error('expected a validation failure');
};

describe('money helpers', () => {
  it('converts rupees to integer paise and rejects sub-paise amounts', () => {
    expect(rupeesToPaise(1250.5)).toBe(125050);
    expect(rupeesToPaise(0.1)).toBe(10);
    expect(() => rupeesToPaise(1.005)).toThrow(AppError);
    expect(() => rupeesToPaise(Number.NaN)).toThrow(AppError);
  });

  it('applies fractional percentages with half-up rounding', () => {
    expect(applyRatePct(100_000, 18)).toBe(18_000);
    expect(applyRatePct(100_000, 0.25)).toBe(250);
    expect(applyRatePct(33_333, 18)).toBe(6_000); // 5999.94 -> 6000
    expect(applyRatePct(1, 18)).toBe(0);
  });

  it('collapses debit/credit totals into a natural balance', () => {
    expect(naturalBalance(1000, 400)).toEqual({ paise: 600, isDebit: true });
    expect(naturalBalance(400, 1000)).toEqual({ paise: 600, isDebit: false });
    expect(naturalBalance(0, 0)).toEqual({ paise: 0, isDebit: true });
    expect(signedNaturalBalance('asset', 1000, 400)).toBe(600);
    expect(signedNaturalBalance('income', 1000, 400)).toBe(-600);
    expect(signedNaturalBalance('liability', 400, 1000)).toBe(600);
  });
});

describe('voucher numbering', () => {
  it('derives the Indian financial year label', () => {
    expect(fyLabelFor(utcMidnight(2026, 9, 9))).toBe('FY 2026-27');
    expect(fyLabelFor(utcMidnight(2027, 3, 31))).toBe('FY 2026-27');
    expect(fyLabelFor(utcMidnight(2027, 4, 1))).toBe('FY 2027-28');
  });

  it('formats zero-padded voucher numbers', () => {
    expect(formatVoucherNo('FY 2026-27', 42)).toBe('JV/2026-27/00042');
    expect(formatVoucherNo('FY 2026-27', 123456)).toBe('JV/2026-27/123456');
  });
});

describe('period locks', () => {
  it('resolves monthly and FY lock windows', () => {
    const month = resolveLockPeriod('2026-09');
    expect(month).toMatchObject({ period: '2026-09', kind: 'monthly' });
    expect(month.periodStart).toEqual(utcMidnight(2026, 9, 1));
    expect(month.periodEnd).toEqual(utcMidnight(2026, 9, 30));

    const fy = resolveLockPeriod('2026-27');
    expect(fy).toMatchObject({ period: 'FY 2026-27', kind: 'fy' });
    expect(fy.periodStart).toEqual(utcMidnight(2026, 4, 1));
    expect(fy.periodEnd).toEqual(utcMidnight(2027, 3, 31));
    expect(resolveLockPeriod('FY 2026-27').period).toBe('FY 2026-27');
  });

  it('rejects malformed periods', () => {
    expect(() => resolveLockPeriod('2026-13')).toThrow(AppError);
    expect(() => resolveLockPeriod('2026-28')).toThrow(AppError);
    expect(() => resolveLockPeriod('September')).toThrow(AppError);
  });

  it('finds the lock covering a date', () => {
    const locks = [resolveLockPeriod('2026-08'), resolveLockPeriod('2026-09')];
    expect(lockCovering(utcMidnight(2026, 9, 15), locks)?.period).toBe('2026-09');
    expect(lockCovering(utcMidnight(2026, 8, 31), locks)?.period).toBe('2026-08');
    expect(lockCovering(utcMidnight(2026, 10, 1), locks)).toBeNull();
  });
});

describe('materialiseVoucher — invariants', () => {
  it('accepts a balanced plain journal and reports totals', () => {
    const result = materialiseVoucher(
      [dr('rent', 50_000), cr('cash', 50_000)],
      ACCOUNTS,
      SYSTEM,
    );
    expect(result.lines).toHaveLength(2);
    expect(result.totalPaise).toBe(50_000);
    expect(result.derived.outputTaxPaise).toBe(0);
  });

  it('rejects an unbalanced voucher', () => {
    expectValidation(
      () => materialiseVoucher([dr('rent', 50_000), cr('cash', 40_000)], ACCOUNTS, SYSTEM),
      'Out of balance',
    );
  });

  it('rejects lines with both or neither side', () => {
    expectValidation(
      () =>
        materialiseVoucher(
          [{ accountId: 'rent', debitPaise: 10, creditPaise: 10 }, cr('cash', 10)],
          ACCOUNTS,
          SYSTEM,
        ),
      'exactly one',
    );
    expectValidation(
      () =>
        materialiseVoucher(
          [{ accountId: 'rent', debitPaise: 0, creditPaise: 0 }, cr('cash', 10)],
          ACCOUNTS,
          SYSTEM,
        ),
      'exactly one',
    );
  });

  it('rejects negative or fractional paise', () => {
    expectValidation(
      () => materialiseVoucher([dr('rent', -5), cr('cash', -5)], ACCOUNTS, SYSTEM),
      'whole paise',
    );
    expectValidation(
      () => materialiseVoucher([dr('rent', 10.5), cr('cash', 10.5)], ACCOUNTS, SYSTEM),
      'whole paise',
    );
  });

  it('rejects fewer than two lines', () => {
    expectValidation(() => materialiseVoucher([dr('rent', 10)], ACCOUNTS, SYSTEM), 'between 2');
  });

  it('rejects unknown and inactive accounts', () => {
    expectValidation(
      () => materialiseVoucher([dr('ghost', 10), cr('cash', 10)], ACCOUNTS, SYSTEM),
      'does not exist',
    );
    expectValidation(
      () => materialiseVoucher([dr('inactive', 10), cr('cash', 10)], ACCOUNTS, SYSTEM),
      'inactive',
    );
  });

  it('rejects tax metadata on duty-account lines', () => {
    expectValidation(
      () =>
        materialiseVoucher(
          [dr('sys-gst-in', 10, { tax: { gstRatePct: 18 } }), cr('cash', 10)],
          ACCOUNTS,
          SYSTEM,
        ),
      'duty account',
    );
  });

  it('rejects taxable value above the line amount and half-specified TDS', () => {
    expectValidation(
      () =>
        materialiseVoucher(
          [dr('rent', 100, { tax: { taxablePaise: 200 } }), cr('cash', 100)],
          ACCOUNTS,
          SYSTEM,
        ),
      'exceed the line amount',
    );
    expectValidation(
      () =>
        materialiseVoucher(
          [dr('rent', 100, { tax: { tdsSection: '194I' } }), cr('cash', 100)],
          ACCOUNTS,
          SYSTEM,
        ),
      'both a section and a rate',
    );
  });
});

describe('materialiseVoucher — derived duty lines', () => {
  it('materialises output GST on a sales line (one base line from the caller)', () => {
    // Debtor owes 1,18,000; sales 1,00,000 @ 18% -> output 18,000 credited.
    const result = materialiseVoucher(
      [
        dr('debtor', 118_000),
        cr('sales', 100_000, { tax: { gstRatePct: 18, hsnSac: '9983' } }),
      ],
      ACCOUNTS,
      SYSTEM,
    );
    const duty = result.lines.find((line) => line.accountId === 'sys-gst-out');
    expect(duty).toMatchObject({ debitPaise: 0, creditPaise: 18_000, isDerived: true });
    expect(result.derived.outputTaxPaise).toBe(18_000);
    expect(result.totalPaise).toBe(118_000);
    expect(result.lines.filter((line) => !line.isDerived)).toHaveLength(2);
  });

  it('materialises input GST on a purchase line', () => {
    const result = materialiseVoucher(
      [dr('purchases', 50_000, { tax: { gstRatePct: 12 } }), cr('creditor', 56_000)],
      ACCOUNTS,
      SYSTEM,
    );
    const duty = result.lines.find((line) => line.accountId === 'sys-gst-in');
    expect(duty).toMatchObject({ debitPaise: 6_000, creditPaise: 0 });
    expect(result.derived.inputTaxPaise).toBe(6_000);
  });

  it('flips output GST to the debit side on a credit note', () => {
    const result = materialiseVoucher(
      [dr('sales', 10_000, { tax: { gstRatePct: 18 } }), cr('debtor', 11_800)],
      ACCOUNTS,
      SYSTEM,
    );
    const duty = result.lines.find((line) => line.accountId === 'sys-gst-out');
    expect(duty).toMatchObject({ debitPaise: 1_800, creditPaise: 0 });
  });

  it('books TDS payable when an expense is debited with a TDS rate', () => {
    // Rent 1,00,000 @ 10% TDS -> creditor gets 90,000, TDS payable 10,000.
    const result = materialiseVoucher(
      [
        dr('rent', 100_000, { tax: { tdsSection: '194I', tdsRatePct: 10 } }),
        cr('creditor', 90_000),
      ],
      ACCOUNTS,
      SYSTEM,
    );
    const tds = result.lines.find((line) => line.accountId === 'sys-tds-pay');
    expect(tds).toMatchObject({ creditPaise: 10_000, isDerived: true });
    expect(result.derived.tdsPayablePaise).toBe(10_000);
    expect(result.totalPaise).toBe(100_000);
  });

  it('books TDS receivable when income is credited net of TDS', () => {
    const result = materialiseVoucher(
      [
        dr('bank', 98_000),
        cr('sales', 100_000, { tax: { tdsSection: '194J', tdsRatePct: 2 } }),
      ],
      ACCOUNTS,
      SYSTEM,
    );
    const tds = result.lines.find((line) => line.accountId === 'sys-tds-rec');
    expect(tds).toMatchObject({ debitPaise: 2_000 });
  });

  it('combines GST and TDS on one line', () => {
    // Professional fee 1,00,000 + 18% GST, TDS 10% on base -> pay 1,08,000.
    const result = materialiseVoucher(
      [
        dr('rent', 100_000, { tax: { gstRatePct: 18, tdsSection: '194J', tdsRatePct: 10 } }),
        cr('creditor', 108_000),
      ],
      ACCOUNTS,
      SYSTEM,
    );
    expect(result.derived.inputTaxPaise).toBe(18_000);
    expect(result.derived.tdsPayablePaise).toBe(10_000);
    expect(result.totalPaise).toBe(118_000);
  });

  it('uses an explicit taxable value when supplied', () => {
    // Only 50,000 of the 1,00,000 line is taxable -> GST 9,000; debtor owes 1,09,000.
    const result = materialiseVoucher(
      [
        dr('debtor', 109_000),
        cr('sales', 100_000, { tax: { gstRatePct: 18, taxablePaise: 50_000 } }),
      ],
      ACCOUNTS,
      SYSTEM,
    );
    expect(result.derived.outputTaxPaise).toBe(9_000);
    expect(result.totalPaise).toBe(109_000);
  });

  it('nets multiple duty lines for the same account into a single derived line', () => {
    const result = materialiseVoucher(
      [
        dr('debtor', 123_600),
        cr('sales', 100_000, { tax: { gstRatePct: 18 } }),
        cr('sales', 5_000, { tax: { gstRatePct: 12 } }),
      ],
      ACCOUNTS,
      SYSTEM,
    );
    const duties = result.lines.filter((line) => line.accountId === 'sys-gst-out');
    expect(duties).toHaveLength(1);
    expect(duties[0]?.creditPaise).toBe(18_600);
  });

  it('absorbs a sub-rupee residual into the rounding account', () => {
    // Sales 33,333 @ 18% -> GST 6,000 (rounded). Debtor paid 39,300 (rounded down 33p).
    const result = materialiseVoucher(
      [dr('debtor', 39_300), cr('sales', 33_333, { tax: { gstRatePct: 18 } })],
      ACCOUNTS,
      SYSTEM,
    );
    const rounding = result.lines.find((line) => line.accountId === 'sys-round');
    expect(rounding).toMatchObject({ debitPaise: 33, creditPaise: 0, isDerived: true });
    expect(result.derived.roundingPaise).toBe(33);
    const debit = result.lines.reduce((sum, line) => sum + line.debitPaise, 0);
    const credit = result.lines.reduce((sum, line) => sum + line.creditPaise, 0);
    expect(debit).toBe(credit);
    expect(result.totalPaise).toBe(debit);
  });

  it('refuses to hide a residual above the rounding tolerance', () => {
    expectValidation(
      () =>
        materialiseVoucher(
          [dr('debtor', 100_000), cr('sales', 100_000, { tax: { gstRatePct: 18 } })],
          ACCOUNTS,
          SYSTEM,
        ),
      'Out of balance',
    );
  });
});

describe('reversalLines', () => {
  it('mirrors every line so the pair nets to zero per account', () => {
    const original = materialiseVoucher(
      [dr('debtor', 118_000), cr('sales', 100_000, { tax: { gstRatePct: 18 } })],
      ACCOUNTS,
      SYSTEM,
    );
    const reversed = reversalLines(original.lines);
    expect(reversed).toHaveLength(original.lines.length);
    const net = new Map<string, number>();
    for (const line of [...original.lines, ...reversed]) {
      net.set(
        line.accountId,
        (net.get(line.accountId) ?? 0) + line.debitPaise - line.creditPaise,
      );
    }
    for (const value of net.values()) expect(value).toBe(0);
    expect(reversed.find((line) => line.accountId === 'sys-gst-out')?.isDerived).toBe(true);
  });
});
