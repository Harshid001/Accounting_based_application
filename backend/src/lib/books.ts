/**
 * Pure double-entry engine. No database, no framework — every invariant the
 * books rely on lives here so it can be unit-tested exhaustively and cannot be
 * bypassed by any caller (service, agent tool, import).
 *
 * All money is integer paise. Signs live in the debit/credit choice, never in
 * the magnitude.
 */

import { financialYearOf, utcMidnight, daysInMonth } from './date.js';
import type {
  AccountSubType,
  AccountType,
  PeriodLockKind,
  SystemAccountSubType,
} from './enums.js';
import { DEBIT_NORMAL_TYPES, MAX_VOUCHER_LINES } from './enums.js';
import { validationFailed } from './errors.js';
import type { FieldError } from './errors.js';

// ---------------------------------------------------------------------------
// Money helpers
// ---------------------------------------------------------------------------

export const isWholePaise = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** Rupees (float, at most 2dp) -> integer paise. Throws on anything not representable. */
export const rupeesToPaise = (rupees: number): number => {
  if (!Number.isFinite(rupees)) throw validationFailed('Amount must be a finite number.');
  const paise = Math.round(rupees * 100);
  if (Math.abs(rupees * 100 - paise) > 1e-6) {
    throw validationFailed('Amounts cannot have more than two decimal places.');
  }
  return paise;
};

export const paiseToRupees = (paise: number): number => paise / 100;

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatPaise = (paise: number): string =>
  inr.format(paise / 100).replace(/\u00A0|\u202F/g, ' ');

/** Percent (may be fractional, e.g. 0.25) applied to paise with half-up rounding, integer-safe. */
export const applyRatePct = (basePaise: number, ratePct: number): number => {
  const rateBp = Math.round(ratePct * 100); // basis points, integer
  return Math.round((basePaise * rateBp) / 10_000);
};

// ---------------------------------------------------------------------------
// Financial year / voucher numbering
// ---------------------------------------------------------------------------

export const VOUCHER_PREFIX = 'JV';

export const fyLabelFor = (date: Date): string => financialYearOf(date).label; // "FY 2026-27"

export const formatVoucherNo = (fyLabel: string, sequence: number): string => {
  const years = fyLabel.replace(/^FY\s+/, '');
  return `${VOUCHER_PREFIX}/${years}/${sequence.toString().padStart(5, '0')}`;
};

// ---------------------------------------------------------------------------
// Period locks
// ---------------------------------------------------------------------------

export interface LockWindow {
  period: string;
  kind: PeriodLockKind;
  periodStart: Date;
  periodEnd: Date;
}

const PERIOD_KEY = /^(FY\s+)?(\d{4})-(\d{2})$/i;

/**
 * Accepts 'YYYY-MM' (monthly) or 'FY 2026-27' / '2026-27' (financial year).
 * A two-digit suffix of 01–12 is a month unless prefixed with "FY"; anything
 * else must be the next year's last two digits.
 */
export const resolveLockPeriod = (input: string): LockWindow => {
  const match = PERIOD_KEY.exec(input.trim());
  if (!match) {
    throw validationFailed('Use a month like 2026-09 or a financial year like 2026-27.');
  }
  const explicitFy = match[1] !== undefined;
  const year = Number(match[2]);
  const suffix = Number(match[3]);

  if (!explicitFy && suffix >= 1 && suffix <= 12) {
    return {
      period: `${year}-${suffix.toString().padStart(2, '0')}`,
      kind: 'monthly',
      periodStart: utcMidnight(year, suffix, 1),
      periodEnd: utcMidnight(year, suffix, daysInMonth(year, suffix)),
    };
  }
  if ((year + 1) % 100 !== suffix) {
    throw validationFailed(
      explicitFy
        ? 'A financial year reads like FY 2026-27.'
        : 'Use a month like 2026-09 or a financial year like 2026-27.',
    );
  }
  return {
    period: `FY ${year}-${suffix.toString().padStart(2, '0')}`,
    kind: 'fy',
    periodStart: utcMidnight(year, 4, 1),
    periodEnd: utcMidnight(year + 1, 3, 31),
  };
};

export const lockCovering = (date: Date, locks: readonly LockWindow[]): LockWindow | null => {
  const t = date.getTime();
  for (const lock of locks) {
    if (lock.periodStart.getTime() <= t && t <= lock.periodEnd.getTime()) return lock;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

export interface NaturalBalance {
  paise: number;
  isDebit: boolean;
}

/** Collapses running debit/credit totals into a single natural-side balance. */
export const naturalBalance = (debitPaise: number, creditPaise: number): NaturalBalance => {
  const net = debitPaise - creditPaise;
  return { paise: Math.abs(net), isDebit: net >= 0 };
};

export const isDebitNormal = (type: AccountType): boolean => DEBIT_NORMAL_TYPES.includes(type);

/**
 * Signed balance from the account's own point of view: positive when the
 * balance sits on the account's natural side, negative otherwise.
 */
export const signedNaturalBalance = (
  type: AccountType,
  debitPaise: number,
  creditPaise: number,
): number => {
  const net = debitPaise - creditPaise;
  return isDebitNormal(type) ? net : -net;
};

// ---------------------------------------------------------------------------
// Voucher materialisation (derived duty lines + invariants)
// ---------------------------------------------------------------------------

export interface LineTaxInput {
  gstRatePct?: number | null;
  hsnSac?: string | null;
  taxablePaise?: number | null;
  placeOfSupply?: string | null;
  tdsSection?: string | null;
  tdsRatePct?: number | null;
}

export interface LineInput {
  accountId: string;
  debitPaise: number;
  creditPaise: number;
  description?: string | null;
  tax?: LineTaxInput | null;
}

export interface AccountInfo {
  id: string;
  name: string;
  type: AccountType;
  subType: AccountSubType | null;
  isActive: boolean;
  /** True for engine-owned duty/rounding accounts, which callers may not post to directly. */
  isSystemDuty: boolean;
}

export type SystemAccountMap = Record<SystemAccountSubType, string>;

export interface MaterialisedLine {
  accountId: string;
  debitPaise: number;
  creditPaise: number;
  description: string | null;
  tax: LineTaxInput | null;
  isDerived: boolean;
}

export interface DerivedTotals {
  outputTaxPaise: number;
  inputTaxPaise: number;
  tdsPayablePaise: number;
  tdsReceivablePaise: number;
  roundingPaise: number;
}

export interface MaterialisedVoucher {
  lines: MaterialisedLine[];
  derived: DerivedTotals;
  totalPaise: number;
}

/** Residual below one rupee is absorbed into the rounding account instead of failing. */
export const ROUNDING_TOLERANCE_PAISE = 99;

const fail = (message: string, details: FieldError[] = []): never => {
  throw validationFailed(message, details);
};

const validateBaseLines = (lines: readonly LineInput[]): void => {
  if (lines.length < 2 || lines.length > MAX_VOUCHER_LINES) {
    fail(`A voucher holds between 2 and ${MAX_VOUCHER_LINES} lines.`, [
      { field: 'lines', message: `Provide between 2 and ${MAX_VOUCHER_LINES} lines.` },
    ]);
  }
  const errors: FieldError[] = [];
  lines.forEach((line, index) => {
    const prefix = `lines.${index}`;
    if (!isWholePaise(line.debitPaise) || !isWholePaise(line.creditPaise)) {
      errors.push({
        field: prefix,
        message: 'Amounts must be whole paise and never negative.',
      });
      return;
    }
    const hasDebit = line.debitPaise > 0;
    const hasCredit = line.creditPaise > 0;
    if (hasDebit === hasCredit) {
      errors.push({
        field: prefix,
        message: 'Enter exactly one of a debit or a credit amount on each line.',
      });
    }
    const tax = line.tax;
    if (tax) {
      if (tax.taxablePaise !== null && tax.taxablePaise !== undefined) {
        if (!isWholePaise(tax.taxablePaise)) {
          errors.push({ field: `${prefix}.tax.taxablePaise`, message: 'Whole paise only.' });
        } else if (tax.taxablePaise > Math.max(line.debitPaise, line.creditPaise)) {
          errors.push({
            field: `${prefix}.tax.taxablePaise`,
            message: 'Taxable value cannot exceed the line amount.',
          });
        }
      }
      const hasTds =
        tax.tdsSection !== null && tax.tdsSection !== undefined && tax.tdsSection !== '';
      const hasTdsRate = tax.tdsRatePct !== null && tax.tdsRatePct !== undefined;
      if (hasTds !== hasTdsRate) {
        errors.push({
          field: `${prefix}.tax`,
          message: 'TDS needs both a section and a rate.',
        });
      }
    }
  });
  if (errors.length > 0) fail('Some voucher lines need attention.', errors);
};

const resolveAccount = (
  accounts: ReadonlyMap<string, AccountInfo>,
  accountId: string,
  index: number,
): AccountInfo => {
  const account = accounts.get(accountId);
  if (!account) {
    return fail('One of the accounts on this voucher does not exist for this client.', [
      { field: `lines.${index}.accountId`, message: 'Choose an account from this client.' },
    ]);
  }
  if (!account.isActive) {
    return fail(`${account.name} is inactive and cannot take new entries.`, [
      { field: `lines.${index}.accountId`, message: 'This account is inactive.' },
    ]);
  }
  return account;
};

/**
 * Takes caller-supplied base lines, appends engine-derived duty/rounding lines,
 * and enforces every invariant. Returns the final line set or throws.
 *
 * Duty-line rules:
 *  - GST on an income-account line -> gst_output, same side as the base line
 *    (sales: Cr output; credit note: Dr output).
 *  - GST on any other account line -> gst_input, same side as the base line
 *    (purchase: Dr input; debit note: Cr input).
 *  - TDS on a debit line (expense) -> tds_payable on the opposite side (Cr).
 *  - TDS on a credit line (income) -> tds_receivable on the opposite side (Dr).
 *  - A residual of at most ROUNDING_TOLERANCE_PAISE is booked to `rounding`.
 */
export const materialiseVoucher = (
  inputLines: readonly LineInput[],
  accounts: ReadonlyMap<string, AccountInfo>,
  system: SystemAccountMap,
): MaterialisedVoucher => {
  validateBaseLines(inputLines);

  const lines: MaterialisedLine[] = [];
  const derived: DerivedTotals = {
    outputTaxPaise: 0,
    inputTaxPaise: 0,
    tdsPayablePaise: 0,
    tdsReceivablePaise: 0,
    roundingPaise: 0,
  };

  const dutyBuckets = new Map<string, { debit: number; credit: number }>();
  const addDuty = (accountId: string, side: 'debit' | 'credit', paise: number): void => {
    if (paise === 0) return;
    const bucket = dutyBuckets.get(accountId) ?? { debit: 0, credit: 0 };
    bucket[side] += paise;
    dutyBuckets.set(accountId, bucket);
  };

  inputLines.forEach((line, index) => {
    const account = resolveAccount(accounts, line.accountId, index);
    if (account.isSystemDuty && line.tax) {
      fail(`${account.name} is a duty account; tax details belong on the base line instead.`, [
        { field: `lines.${index}.tax`, message: 'Remove tax details from duty-account lines.' },
      ]);
    }
    const isDebit = line.debitPaise > 0;
    const amount = isDebit ? line.debitPaise : line.creditPaise;
    lines.push({
      accountId: line.accountId,
      debitPaise: line.debitPaise,
      creditPaise: line.creditPaise,
      description: line.description ?? null,
      tax: line.tax ?? null,
      isDerived: false,
    });

    const tax = line.tax;
    if (!tax) return;
    const base = tax.taxablePaise ?? amount;

    if (tax.gstRatePct !== null && tax.gstRatePct !== undefined && tax.gstRatePct > 0) {
      const gst = applyRatePct(base, tax.gstRatePct);
      if (account.type === 'income') {
        addDuty(system.gst_output, isDebit ? 'debit' : 'credit', gst);
        derived.outputTaxPaise += gst;
      } else {
        addDuty(system.gst_input, isDebit ? 'debit' : 'credit', gst);
        derived.inputTaxPaise += gst;
      }
    }

    if (tax.tdsRatePct !== null && tax.tdsRatePct !== undefined && tax.tdsRatePct > 0) {
      const tds = applyRatePct(base, tax.tdsRatePct);
      if (isDebit) {
        addDuty(system.tds_payable, 'credit', tds);
        derived.tdsPayablePaise += tds;
      } else {
        addDuty(system.tds_receivable, 'debit', tds);
        derived.tdsReceivablePaise += tds;
      }
    }
  });

  for (const [accountId, bucket] of dutyBuckets) {
    const net = bucket.debit - bucket.credit;
    if (net === 0) continue;
    lines.push({
      accountId,
      debitPaise: net > 0 ? net : 0,
      creditPaise: net < 0 ? -net : 0,
      description: null,
      tax: null,
      isDerived: true,
    });
  }

  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    debit += line.debitPaise;
    credit += line.creditPaise;
  }

  const residual = debit - credit;
  if (residual !== 0) {
    if (Math.abs(residual) <= ROUNDING_TOLERANCE_PAISE) {
      lines.push({
        accountId: system.rounding,
        debitPaise: residual < 0 ? -residual : 0,
        creditPaise: residual > 0 ? residual : 0,
        description: 'Rounding',
        tax: null,
        isDerived: true,
      });
      derived.roundingPaise = Math.abs(residual);
      // After the rounding line both sides equal max(debit, credit).
      debit = Math.max(debit, credit);
    } else {
      const side = residual > 0 ? 'Debits' : 'Credits';
      fail(
        `${side} exceed the other side by ${formatPaise(Math.abs(residual))} after tax lines. Adjust the entries so the voucher balances.`,
        [{ field: 'lines', message: `Out of balance by ${formatPaise(Math.abs(residual))}.` }],
      );
    }
  }

  if (lines.length > MAX_VOUCHER_LINES) {
    fail(`A voucher holds at most ${MAX_VOUCHER_LINES} lines including tax lines.`);
  }

  return { lines, derived, totalPaise: debit };
};

/** Mirror image of a posted voucher's lines: every debit becomes a credit and vice versa. */
export const reversalLines = (lines: readonly MaterialisedLine[]): MaterialisedLine[] =>
  lines.map((line) => ({
    accountId: line.accountId,
    debitPaise: line.creditPaise,
    creditPaise: line.debitPaise,
    description: line.description,
    tax: line.tax,
    isDerived: line.isDerived,
  }));
