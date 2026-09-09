import { z } from 'zod';

import {
  ACCOUNT_SUB_TYPES,
  ACCOUNT_TYPES,
  MAX_VOUCHER_LINES,
  VOUCHER_SOURCES,
  VOUCHER_STATUSES,
  VOUCHER_TYPES,
} from '../lib/enums.js';
import { GSTIN_PATTERN, PAN_PATTERN } from '../lib/identifiers.js';
import {
  dateOnlyString,
  nullableText,
  objectId,
  optionalBooleanQuery,
  optionalDateOnly,
  pageQuery,
  searchTerm,
  sortParam,
  trimmedString,
} from './common.validators.js';

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

/** Integer paise, never negative. Accepts numbers or numeric strings from forms. */
export const paise = z.coerce
  .number()
  .int('Amounts are whole paise.')
  .min(0, 'Amounts cannot be negative.')
  .max(9_999_999_999_999, 'This amount is too large.');

const upper = z.string().trim().toUpperCase();

const nullableIdentifier = (pattern: RegExp, message: string) =>
  z.union([upper.regex(pattern, message), z.literal(''), z.null()]).optional();

const percent = z.coerce.number().min(0).max(100);

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export const accountListQuery = pageQuery.extend({
  client: objectId,
  q: searchTerm,
  type: z.enum(ACCOUNT_TYPES).optional(),
  subType: z.enum(ACCOUNT_SUB_TYPES).optional(),
  includeInactive: optionalBooleanQuery,
  sort: sortParam,
});

const partySchema = z.object({
  gstin: nullableIdentifier(
    GSTIN_PATTERN,
    'A GSTIN is 15 characters, such as 27ABCDE1234F1Z5.',
  ),
  pan: nullableIdentifier(PAN_PATTERN, 'A PAN looks like ABCDE1234F.'),
});

const openingBalanceSchema = z.object({
  paise,
  asOf: dateOnlyString,
  isDebit: z.boolean(),
});

export const createAccountBody = z.object({
  clientId: objectId,
  code: trimmedString(1, 24).transform((value) => value.toUpperCase()),
  name: trimmedString(1, 160),
  type: z.enum(ACCOUNT_TYPES),
  subType: z.union([z.enum(ACCOUNT_SUB_TYPES), z.null()]).optional(),
  parentId: z.union([objectId, z.null()]).optional(),
  party: z.union([partySchema, z.null()]).optional(),
  openingBalance: openingBalanceSchema.optional(),
});

export const updateAccountBody = z.object({
  name: trimmedString(1, 160).optional(),
  subType: z.union([z.enum(ACCOUNT_SUB_TYPES), z.null()]).optional(),
  parentId: z.union([objectId, z.null()]).optional(),
  party: z.union([partySchema, z.null()]).optional(),
  openingBalance: openingBalanceSchema.optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Vouchers
// ---------------------------------------------------------------------------

export const lineTaxSchema = z
  .object({
    gstRatePct: z.union([percent, z.null()]).optional(),
    hsnSac: nullableText(8),
    taxablePaise: z.union([paise, z.null()]).optional(),
    placeOfSupply: z
      .union([
        z
          .string()
          .trim()
          .regex(/^\d{2}$/, 'Use a two-digit state code.'),
        z.null(),
      ])
      .optional(),
    tdsSection: nullableText(12),
    tdsRatePct: z.union([percent, z.null()]).optional(),
  })
  .strict();

export const voucherLineSchema = z
  .object({
    accountId: objectId,
    debitPaise: paise.default(0),
    creditPaise: paise.default(0),
    description: nullableText(500),
    tax: z.union([lineTaxSchema, z.null()]).optional(),
  })
  .strict()
  .superRefine((line, ctx) => {
    if (line.debitPaise > 0 === line.creditPaise > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['debitPaise'],
        message: 'Enter exactly one of a debit or a credit amount.',
      });
    }
  });

const voucherCore = {
  date: dateOnlyString,
  type: z.enum(VOUCHER_TYPES).default('journal'),
  narration: nullableText(2000),
  reference: nullableText(120),
  lines: z.array(voucherLineSchema).min(2).max(MAX_VOUCHER_LINES),
};

export const createVoucherBody = z.object({
  clientId: objectId,
  source: z.enum(VOUCHER_SOURCES).exclude(['reversal']).default('manual'),
  ...voucherCore,
});

export const updateVoucherBody = z.object({
  date: optionalDateOnly,
  type: z.enum(VOUCHER_TYPES).optional(),
  narration: nullableText(2000),
  reference: nullableText(120),
  lines: z.array(voucherLineSchema).min(2).max(MAX_VOUCHER_LINES).optional(),
});

export const voucherListQuery = pageQuery.extend({
  client: objectId,
  status: z.enum(VOUCHER_STATUSES).optional(),
  type: z.enum(VOUCHER_TYPES).optional(),
  source: z.enum(VOUCHER_SOURCES).optional(),
  account: objectId.optional(),
  from: optionalDateOnly,
  to: optionalDateOnly,
  q: searchTerm,
  sort: sortParam,
});

export const reverseVoucherBody = z.object({
  reason: trimmedString(3, 500),
  /** Defaults to today; the service clamps into the earliest open period if locked. */
  date: optionalDateOnly,
});

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const ledgerQuery = pageQuery.extend({
  client: objectId,
  account: objectId,
  from: optionalDateOnly,
  to: optionalDateOnly,
  includeDrafts: optionalBooleanQuery,
});

export const trialBalanceQuery = z.object({
  client: objectId,
  asOf: optionalDateOnly,
  includeDrafts: optionalBooleanQuery,
});

export const dayBookQuery = pageQuery.extend({
  client: objectId,
  from: optionalDateOnly,
  to: optionalDateOnly,
  includeDrafts: optionalBooleanQuery,
});

// ---------------------------------------------------------------------------
// Period locks
// ---------------------------------------------------------------------------

export const periodParam = z.object({
  period: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}|(FY\s+)?\d{4}-\d{2})$/, 'Use 2026-09 or 2026-27.'),
});

export const lockPeriodBody = z.object({
  clientId: objectId,
  /** Typed confirmation, e.g. "LOCK 2026-09". */
  confirm: trimmedString(1, 60),
  note: nullableText(500),
});

export const periodLockListQuery = z.object({ client: objectId });

export const booksStatusQuery = z.object({ client: objectId });

export type CreateAccountBody = z.infer<typeof createAccountBody>;
export type UpdateAccountBody = z.infer<typeof updateAccountBody>;
export type AccountListQuery = z.infer<typeof accountListQuery>;
export type CreateVoucherBody = z.infer<typeof createVoucherBody>;
export type UpdateVoucherBody = z.infer<typeof updateVoucherBody>;
export type VoucherListQuery = z.infer<typeof voucherListQuery>;
export type ReverseVoucherBody = z.infer<typeof reverseVoucherBody>;
export type LedgerQuery = z.infer<typeof ledgerQuery>;
export type TrialBalanceQuery = z.infer<typeof trialBalanceQuery>;
export type DayBookQuery = z.infer<typeof dayBookQuery>;
export type LockPeriodBody = z.infer<typeof lockPeriodBody>;
export type VoucherLineInput = z.infer<typeof voucherLineSchema>;
