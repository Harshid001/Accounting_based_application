import { z } from 'zod';

import { formatPaise, rupeesStringToPaise } from '@/lib/format';
import { ACCOUNT_SUB_TYPES, ACCOUNT_TYPES, VOUCHER_TYPES } from '@/types/enums';
import type { AccountView, VoucherView } from '@/types/models';

const requiredDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.');

/** Rupees typed by a person: "1,18,000" / "1180.50" / "" (empty = zero). */
const rupees = z
  .string()
  .trim()
  .refine((value) => rupeesStringToPaise(value) !== null, 'Enter an amount like 1180.50.');

const optionalPercent = z
  .string()
  .trim()
  .refine(
    (value) => value.length === 0 || /^\d{1,3}(\.\d{1,2})?$/.test(value),
    'Enter a percentage like 18 or 0.25.',
  );

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export const accountSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Give the account a short code, like 1001.')
    .max(24, 'Keep the code under 24 characters.'),
  name: z
    .string()
    .trim()
    .min(1, 'Name the account.')
    .max(160, 'Keep the name under 160 characters.'),
  type: z.enum(ACCOUNT_TYPES),
  subType: z.enum([...ACCOUNT_SUB_TYPES, '']),
  gstin: z.string().trim().max(15, 'A GSTIN is 15 characters.'),
  pan: z.string().trim().max(10, 'A PAN is 10 characters.'),
  openingAmount: rupees,
  openingSide: z.enum(['Dr', 'Cr']),
  openingAsOf: requiredDate,
});
export type AccountFormValues = z.infer<typeof accountSchema>;

export const emptyAccount = (fyStart: string): AccountFormValues => ({
  code: '',
  name: '',
  type: 'asset',
  subType: '',
  gstin: '',
  pan: '',
  openingAmount: '',
  openingSide: 'Dr',
  openingAsOf: fyStart,
});

export const accountToForm = (account: AccountView): AccountFormValues => ({
  code: account.code,
  name: account.name,
  type: account.type,
  subType: account.subType ?? '',
  gstin: account.party?.gstin ?? '',
  pan: account.party?.pan ?? '',
  openingAmount: (account.openingBalance.paise / 100).toFixed(2),
  openingSide: account.openingBalance.side,
  openingAsOf: account.openingBalance.asOf ?? '',
});

export const toAccountPayload = (
  values: AccountFormValues,
  options: { clientId?: string; isEdit?: boolean } = {},
): Record<string, unknown> => {
  const party =
    values.gstin.length > 0 || values.pan.length > 0
      ? { gstin: values.gstin || null, pan: values.pan || null }
      : null;
  const base: Record<string, unknown> = {
    name: values.name,
    subType: values.subType === '' ? null : values.subType,
    party,
    openingBalance: {
      paise: rupeesStringToPaise(values.openingAmount) ?? 0,
      asOf: values.openingAsOf,
      isDebit: values.openingSide === 'Dr',
    },
  };
  if (options.isEdit) return base;
  return { ...base, clientId: options.clientId, code: values.code, type: values.type };
};

// ---------------------------------------------------------------------------
// Vouchers
// ---------------------------------------------------------------------------

export const voucherLineSchema = z.object({
  accountId: z.string().trim().min(1, 'Choose an account.'),
  debit: rupees,
  credit: rupees,
  description: z.string().trim().max(500, 'Keep this under 500 characters.'),
  gstRatePct: optionalPercent,
  hsnSac: z.string().trim().max(8, 'HSN/SAC is at most 8 digits.'),
  placeOfSupply: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || /^\d{2}$/.test(value), 'Two-digit state code.'),
  tdsSection: z.string().trim().max(12, 'Keep the section short, like 194J.'),
  tdsRatePct: optionalPercent,
});
export type VoucherLineFormValues = z.infer<typeof voucherLineSchema>;

export const emptyLine = (): VoucherLineFormValues => ({
  accountId: '',
  debit: '',
  credit: '',
  description: '',
  gstRatePct: '',
  hsnSac: '',
  placeOfSupply: '',
  tdsSection: '',
  tdsRatePct: '',
});

export const voucherSchema = z
  .object({
    date: requiredDate,
    type: z.enum(VOUCHER_TYPES),
    narration: z.string().trim().max(2000, 'Keep the narration under 2000 characters.'),
    reference: z.string().trim().max(120, 'Keep the reference under 120 characters.'),
    lines: z.array(voucherLineSchema).min(2, 'A voucher needs at least two lines.'),
  })
  .superRefine((value, ctx) => {
    let hasLineError = false;
    value.lines.forEach((line, index) => {
      const debit = rupeesStringToPaise(line.debit) ?? 0;
      const credit = rupeesStringToPaise(line.credit) ?? 0;
      if (debit > 0 === credit > 0) {
        hasLineError = true;
        ctx.addIssue({
          code: 'custom',
          path: ['lines', index, 'debit'],
          message: 'Enter either a debit or a credit on this line, not both or neither.',
        });
      }
      const hasSection = line.tdsSection.length > 0;
      const hasRate = line.tdsRatePct.length > 0;
      if (hasSection !== hasRate) {
        hasLineError = true;
        ctx.addIssue({
          code: 'custom',
          path: ['lines', index, 'tdsSection'],
          message: 'TDS needs both a section and a rate.',
        });
      }
    });
    // Block unbalanced vouchers client-side, projecting the duty lines the
    // engine will append (GST same side, TDS opposite, <=99p auto-rounded)
    // so GST-inclusive entries are not rejected wrongly.
    if (!hasLineError) {
      const projected = projectTotalsWithDuties(value.lines);
      if (projected.residual !== 0) {
        const side = projected.residual > 0 ? 'Debits' : 'Credits';
        ctx.addIssue({
          code: 'custom',
          path: ['lines'],
          message: `${side} exceed the other side by ${formatPaise(Math.abs(projected.residual))} after tax lines. Adjust the entries so the voucher balances.`,
        });
      }
    }
  });
export type VoucherFormValues = z.infer<typeof voucherSchema>;

export const emptyVoucher = (date: string): VoucherFormValues => ({
  date,
  type: 'journal',
  narration: '',
  reference: '',
  lines: [emptyLine(), emptyLine()],
});

const pct = (raw: string): number | null => (raw.length === 0 ? null : Number(raw));

export const toVoucherPayload = (
  values: VoucherFormValues,
  options: { clientId?: string } = {},
): Record<string, unknown> => ({
  ...(options.clientId === undefined ? {} : { clientId: options.clientId }),
  date: values.date,
  type: values.type,
  narration: values.narration.length === 0 ? null : values.narration,
  reference: values.reference.length === 0 ? null : values.reference,
  lines: values.lines.map((line) => {
    const gst = pct(line.gstRatePct);
    const tds = pct(line.tdsRatePct);
    const hasTax =
      gst !== null || tds !== null || line.hsnSac.length > 0 || line.placeOfSupply.length > 0;
    return {
      accountId: line.accountId,
      debitPaise: rupeesStringToPaise(line.debit) ?? 0,
      creditPaise: rupeesStringToPaise(line.credit) ?? 0,
      description: line.description.length === 0 ? null : line.description,
      tax: hasTax
        ? {
            gstRatePct: gst,
            hsnSac: line.hsnSac.length === 0 ? null : line.hsnSac,
            placeOfSupply: line.placeOfSupply.length === 0 ? null : line.placeOfSupply,
            tdsSection: line.tdsSection.length === 0 ? null : line.tdsSection,
            tdsRatePct: tds,
          }
        : null,
    };
  }),
});

/** Editing loads only the caller's base lines; derived duty lines are re-materialised on save. */
export const voucherToForm = (voucher: VoucherView): VoucherFormValues => ({
  date: voucher.date ?? '',
  type: voucher.type,
  narration: voucher.narration ?? '',
  reference: voucher.reference ?? '',
  lines: voucher.lines
    .filter((line) => !line.isDerived)
    .map((line) => ({
      accountId: line.account?.id ?? '',
      debit: line.debit.paise > 0 ? (line.debit.paise / 100).toFixed(2) : '',
      credit: line.credit.paise > 0 ? (line.credit.paise / 100).toFixed(2) : '',
      description: line.description ?? '',
      gstRatePct:
        line.tax?.gstRatePct === null || line.tax?.gstRatePct === undefined
          ? ''
          : String(line.tax.gstRatePct),
      hsnSac: line.tax?.hsnSac ?? '',
      placeOfSupply: line.tax?.placeOfSupply ?? '',
      tdsSection: line.tax?.tdsSection ?? '',
      tdsRatePct:
        line.tax?.tdsRatePct === null || line.tax?.tdsRatePct === undefined
          ? ''
          : String(line.tax.tdsRatePct),
    })),
});

/** Live totals for the entry screen footer, in paise. */
export const lineTotals = (
  lines: readonly VoucherLineFormValues[],
): { debit: number; credit: number } =>
  lines.reduce(
    (sum, line) => ({
      debit: sum.debit + (rupeesStringToPaise(line.debit) ?? 0),
      credit: sum.credit + (rupeesStringToPaise(line.credit) ?? 0),
    }),
    { debit: 0, credit: 0 },
  );

// ---------------------------------------------------------------------------
// Client-side projection of the backend's duty-line materialisation
// (backend/src/lib/books.ts): GST goes on the SAME side as its base line,
// TDS on the OPPOSITE side, and a residual of at most 99p is absorbed by
// the rounding line. Mirrors the engine so the form can block unbalanced
// vouchers before they ever reach the server.
// ---------------------------------------------------------------------------

/** Mirrors backend applyRatePct: basis-point maths, half-up to the paisa. */
const applyRatePct = (basePaise: number, ratePct: number): number => {
  const rateBp = Math.round(ratePct * 100);
  return Math.round((basePaise * rateBp) / 10_000);
};

/** Backend ROUNDING_TOLERANCE_PAISE. */
const ROUNDING_TOLERANCE_PAISE = 99;

/**
 * Projects the final Dr/Cr totals after the engine appends GST/TDS duty
 * lines (and the rounding line, when the residual fits the tolerance).
 * The base-line account types are not needed: GST always follows its base
 * line's side and TDS always flips.
 */
export const projectTotalsWithDuties = (
  lines: readonly VoucherLineFormValues[],
): { debit: number; credit: number; residual: number } => {
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    const lineDebit = rupeesStringToPaise(line.debit) ?? 0;
    const lineCredit = rupeesStringToPaise(line.credit) ?? 0;
    debit += lineDebit;
    credit += lineCredit;
    const isDebit = lineDebit > 0;
    const base = isDebit ? lineDebit : lineCredit;
    const gst = pctValue(line.gstRatePct);
    if (gst !== null && gst > 0 && base > 0) {
      const amount = applyRatePct(base, gst);
      if (isDebit) {
        debit += amount;
      } else {
        credit += amount;
      }
    }
    const tds = pctValue(line.tdsRatePct);
    if (tds !== null && tds > 0 && base > 0) {
      const amount = applyRatePct(base, tds);
      if (isDebit) {
        credit += amount;
      } else {
        debit += amount;
      }
    }
  }
  const residual = debit - credit;
  if (residual !== 0 && Math.abs(residual) <= ROUNDING_TOLERANCE_PAISE) {
    // The rounding line closes a residual within the tolerance.
    return { debit: Math.max(debit, credit), credit: Math.max(debit, credit), residual: 0 };
  }
  return { debit, credit, residual };
};

const pctValue = (raw: string): number | null => {
  if (raw.length === 0) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};
