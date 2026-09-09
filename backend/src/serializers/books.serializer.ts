import type { NaturalBalance } from '../lib/books.js';
import { formatPaise } from '../lib/books.js';
import type { AccountAttributes } from '../models/ledgerAccount.model.js';
import type {
  JournalVoucherAttributes,
  VoucherLineAttributes,
} from '../models/journalVoucher.model.js';
import type { PeriodLockAttributes } from '../models/periodLock.model.js';
import type { BooksStatus } from '../services/books.service.js';
import type {
  LedgerEntry,
  LedgerStatement,
  TrialBalance,
} from '../services/booksReports.service.js';
import type { Lean } from '../types/lean.js';
import { dateOnly, idOf, textOf, timestamp } from './common.js';

export interface MoneyView {
  paise: number;
  display: string;
}

export const money = (paise: number): MoneyView => ({ paise, display: formatPaise(paise) });

export interface BalanceView extends MoneyView {
  side: 'Dr' | 'Cr';
}

export const balanceView = (balance: NaturalBalance): BalanceView => ({
  ...money(balance.paise),
  side: balance.isDebit ? 'Dr' : 'Cr',
});

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export interface AccountView {
  id: string;
  code: string;
  name: string;
  type: string;
  subType: string | null;
  parentId: string | null;
  party: { gstin: string | null; pan: string | null } | null;
  openingBalance: { paise: number; display: string; side: 'Dr' | 'Cr'; asOf: string | null };
  isActive: boolean;
  isSystem: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export const serialiseAccount = (account: Lean<AccountAttributes>): AccountView => ({
  id: account._id.toString(),
  code: account.code,
  name: account.name,
  type: account.type,
  subType: account.subType ?? null,
  parentId: idOf(account.parent),
  party: account.party
    ? { gstin: account.party.gstin ?? null, pan: account.party.pan ?? null }
    : null,
  openingBalance: {
    ...money(account.openingBalance.paise),
    side: account.openingBalance.isDebit ? 'Dr' : 'Cr',
    asOf: dateOnly(account.openingBalance.asOf),
  },
  isActive: account.isActive,
  isSystem: account.isSystem,
  createdAt: timestamp(account.createdAt),
  updatedAt: timestamp(account.updatedAt),
});

// ---------------------------------------------------------------------------
// Vouchers
// ---------------------------------------------------------------------------

export interface AccountRef {
  id: string;
  code: string;
  name: string;
  type: string | null;
  subType: string | null;
}

const accountRef = (value: unknown): AccountRef | null => {
  const id = idOf(value);
  if (id === null) return null;
  return {
    id,
    code: textOf(value, 'code') ?? '',
    name: textOf(value, 'name') ?? '',
    type: textOf(value, 'type'),
    subType: textOf(value, 'subType'),
  };
};

export interface VoucherLineView {
  account: AccountRef | null;
  debit: MoneyView;
  credit: MoneyView;
  description: string | null;
  tax: VoucherLineAttributes['tax'];
  isDerived: boolean;
}

export interface VoucherView {
  id: string;
  voucherNo: string | null;
  fyLabel: string;
  date: string | null;
  type: string;
  status: string;
  source: string;
  narration: string | null;
  reference: string | null;
  total: MoneyView;
  derived: {
    outputTax: MoneyView;
    inputTax: MoneyView;
    tdsPayable: MoneyView;
    tdsReceivable: MoneyView;
    rounding: MoneyView;
  };
  lines: VoucherLineView[];
  tallySync: JournalVoucherAttributes['tallySync'];
  postedAt: string | null;
  postedBy: string | null;
  reversalOf: string | null;
  reversedBy: string | null;
  lockedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export const serialiseVoucher = (voucher: Lean<JournalVoucherAttributes>): VoucherView => ({
  id: voucher._id.toString(),
  voucherNo: voucher.voucherNo ?? null,
  fyLabel: voucher.fyLabel,
  date: dateOnly(voucher.date),
  type: voucher.type,
  status: voucher.status,
  source: voucher.source,
  narration: voucher.narration ?? null,
  reference: voucher.reference ?? null,
  total: money(voucher.totalPaise),
  derived: {
    outputTax: money(voucher.derived.outputTaxPaise),
    inputTax: money(voucher.derived.inputTaxPaise),
    tdsPayable: money(voucher.derived.tdsPayablePaise),
    tdsReceivable: money(voucher.derived.tdsReceivablePaise),
    rounding: money(voucher.derived.roundingPaise),
  },
  lines: voucher.lines.map((line) => ({
    account: accountRef(line.account),
    debit: money(line.debitPaise),
    credit: money(line.creditPaise),
    description: line.description ?? null,
    tax: line.tax ?? null,
    isDerived: line.isDerived,
  })),
  tallySync: voucher.tallySync ?? null,
  postedAt: timestamp(voucher.postedAt),
  postedBy: idOf(voucher.postedBy),
  reversalOf: idOf(voucher.reversalOf),
  reversedBy: idOf(voucher.reversedBy),
  lockedAt: timestamp(voucher.lockedAt),
  createdAt: timestamp(voucher.createdAt),
  updatedAt: timestamp(voucher.updatedAt),
});

// ---------------------------------------------------------------------------
// Locks & status
// ---------------------------------------------------------------------------

export interface PeriodLockView {
  id: string;
  period: string;
  kind: string;
  periodStart: string | null;
  periodEnd: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  note: string | null;
}

export const serialisePeriodLock = (lock: Lean<PeriodLockAttributes>): PeriodLockView => ({
  id: lock._id.toString(),
  period: lock.period,
  kind: lock.kind,
  periodStart: dateOnly(lock.periodStart),
  periodEnd: dateOnly(lock.periodEnd),
  lockedAt: timestamp(lock.lockedAt),
  lockedBy: idOf(lock.lockedBy),
  note: lock.note ?? null,
});

export const serialiseBooksStatus = (status: BooksStatus) => ({
  booksMode: status.booksMode,
  tallyConfig: status.tallyConfig,
  accounts: status.accounts,
  vouchers: status.vouchers,
  locks: status.locks.map(serialisePeriodLock),
  lastPostedAt: timestamp(status.lastPostedAt),
});

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

const serialiseLedgerEntry = (entry: LedgerEntry) => ({
  voucherId: entry.voucherId,
  voucherNo: entry.voucherNo,
  date: dateOnly(entry.date),
  type: entry.type,
  status: entry.status,
  narration: entry.narration,
  description: entry.description,
  debit: money(entry.debitPaise),
  credit: money(entry.creditPaise),
  balance: balanceView(entry.balance),
});

export const serialiseLedger = (statement: LedgerStatement) => ({
  account: serialiseAccount(statement.account),
  from: dateOnly(statement.from),
  to: dateOnly(statement.to),
  opening: balanceView(statement.opening),
  entries: statement.entries.map(serialiseLedgerEntry),
  totals: {
    debit: money(statement.totals.debitPaise),
    credit: money(statement.totals.creditPaise),
  },
  closing: balanceView(statement.closing),
});

export const serialiseTrialBalance = (tb: TrialBalance) => ({
  asOf: dateOnly(tb.asOf),
  includeDrafts: tb.includeDrafts,
  balanced: tb.balanced,
  totals: { debit: money(tb.totals.debitPaise), credit: money(tb.totals.creditPaise) },
  groups: tb.groups.map((group) => ({
    type: group.type,
    debit: money(group.debitPaise),
    credit: money(group.creditPaise),
    rows: group.rows.map((row) => ({
      accountId: row.accountId,
      code: row.code,
      name: row.name,
      type: row.type,
      subType: row.subType,
      isSystem: row.isSystem,
      debit: money(row.debitPaise),
      credit: money(row.creditPaise),
      balance: balanceView(row.balance),
    })),
  })),
});
