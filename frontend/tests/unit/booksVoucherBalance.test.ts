import { describe, expect, it } from 'vitest';

import {
  emptyLine,
  emptyVoucher,
  lineTotals,
  projectTotalsWithDuties,
  voucherSchema,
} from '@/schemas/books.schema';

const line = (over: Partial<ReturnType<typeof emptyLine>> = {}) => ({
  ...emptyLine(),
  ...over,
});

describe('projectTotalsWithDuties', () => {
  it('passes through plain balanced lines untouched', () => {
    const result = projectTotalsWithDuties([
      line({ accountId: 'a', debit: '15000' }),
      line({ accountId: 'b', credit: '15000' }),
    ]);
    expect(result).toEqual({ debit: 1_500_000, credit: 1_500_000, residual: 0 });
  });

  it('puts GST on the same side as its base line (GST-exclusive entry balances)', () => {
    // Classic sales: Dr party 1180, Cr sales 1000 + 18% output GST (180).
    const result = projectTotalsWithDuties([
      line({ accountId: 'a', debit: '1180' }),
      line({ accountId: 'b', credit: '1000', gstRatePct: '18' }),
    ]);
    expect(result).toEqual({ debit: 118_000, credit: 118_000, residual: 0 });
  });

  it('puts TDS on the opposite side of its base line (expense + TDS entry)', () => {
    // Expense 1000 Dr with 10% TDS: Cr bank 900, TDS payable 100.
    const result = projectTotalsWithDuties([
      line({ accountId: 'a', debit: '1000', tdsRatePct: '10' }),
      line({ accountId: 'b', credit: '900' }),
    ]);
    expect(result).toEqual({ debit: 100_000, credit: 100_000, residual: 0 });
  });

  it('absorbs a residual within the 99p rounding tolerance', () => {
    // 100 + 18% = 118 exactly; force a 50p residual scenario:
    // Dr 118.50, Cr 100 + 18% GST = 118 -> 0.50 residual, within tolerance.
    const result = projectTotalsWithDuties([
      line({ accountId: 'a', debit: '118.50' }),
      line({ accountId: 'b', credit: '100', gstRatePct: '18' }),
    ]);
    expect(result.residual).toBe(0);
    expect(result.debit).toBe(result.credit);
  });

  it('reports a real imbalance beyond the tolerance', () => {
    const result = projectTotalsWithDuties([
      line({ accountId: 'a', debit: '2000' }),
      line({ accountId: 'b', credit: '1500' }),
    ]);
    expect(result.residual).toBe(50_000);
    expect(result.debit).toBe(200_000);
    expect(result.credit).toBe(150_000);
  });

  it('ignores tax on zero-amount lines', () => {
    const result = projectTotalsWithDuties([
      line({ accountId: 'a', debit: '100' }),
      line({ accountId: 'b', credit: '100' }),
      line({ accountId: 'c', gstRatePct: '18', tdsRatePct: '10' }),
    ]);
    // Third line is blank except stray tax fields — no amount, no duty.
    expect(result).toEqual({ debit: 10_000, credit: 10_000, residual: 0 });
  });
});

describe('voucherSchema balance blocking', () => {
  const base = () => {
    const dr = line({ accountId: 'a' });
    const cr = line({ accountId: 'b' });
    return { values: { ...emptyVoucher('2026-09-10'), lines: [dr, cr] }, dr, cr };
  };

  it('accepts a balanced voucher', () => {
    const { values, dr, cr } = base();
    dr.debit = '15000';
    cr.credit = '15000';
    expect(voucherSchema.safeParse(values).success).toBe(true);
  });

  it('accepts a GST-inclusive sales voucher the engine will balance', () => {
    const { values, dr, cr } = base();
    dr.debit = '1180';
    cr.credit = '1000';
    cr.gstRatePct = '18';
    expect(voucherSchema.safeParse(values).success).toBe(true);
  });

  it('blocks an unbalanced voucher with the projected difference', () => {
    const { values, dr, cr } = base();
    dr.debit = '2000';
    cr.credit = '1500';
    const parsed = voucherSchema.safeParse(values);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const message = parsed.error.issues.find((issue) =>
        issue.path.includes('lines'),
      )?.message;
      expect(message).toContain('Debits exceed the other side by ₹500.00');
    }
  });

  it('blocks a voucher whose imbalance survives projected tax lines', () => {
    const { values, dr, cr } = base();
    // Dr 1500, Cr 1000 + 18% = 1180 -> credits short by 320 even after GST.
    dr.debit = '1500';
    cr.credit = '1000';
    cr.gstRatePct = '18';
    const parsed = voucherSchema.safeParse(values);
    expect(parsed.success).toBe(false);
  });

  it('still blocks a line carrying both debit and credit', () => {
    const { values, dr, cr } = base();
    dr.debit = '100';
    dr.credit = '100';
    cr.debit = '100';
    cr.credit = '100';
    expect(voucherSchema.safeParse(values).success).toBe(false);
  });
});

describe('lineTotals (base lines only)', () => {
  it('sums debits and credits before duty lines', () => {
    const totals = lineTotals([
      line({ debit: '15000' }),
      line({ credit: '1000', gstRatePct: '18' }),
    ]);
    expect(totals).toEqual({ debit: 1_500_000, credit: 100_000 });
  });
});
