import type { PipelineStage, QueryFilter, Types } from 'mongoose';

import { naturalBalance } from '../lib/books.js';
import type { NaturalBalance } from '../lib/books.js';
import { cache, createCacheKey } from '../lib/cache.js';
import type { AccountType } from '../lib/enums.js';
import { ACCOUNT_TYPES } from '../lib/enums.js';
import { notFound } from '../lib/errors.js';
import type { PageRequest } from '../lib/pagination.js';
import type { AccountAttributes } from '../models/ledgerAccount.model.js';
import { Account } from '../models/ledgerAccount.model.js';
import type { JournalVoucherAttributes } from '../models/journalVoucher.model.js';
import { JournalVoucher } from '../models/journalVoucher.model.js';
import type { Lean } from '../types/lean.js';

/** Statuses whose amounts count towards balances. Drafts are excluded unless asked for. */
const EFFECTIVE_STATUSES = ['posted', 'reversed', 'locked'] as const;

const statusFilter = (
  includeDrafts: boolean,
): QueryFilter<JournalVoucherAttributes>['status'] =>
  includeDrafts ? { $in: [...EFFECTIVE_STATUSES, 'draft'] } : { $in: [...EFFECTIVE_STATUSES] };

// ---------------------------------------------------------------------------
// Day book
// ---------------------------------------------------------------------------

export const dayBook = async (
  clientId: Types.ObjectId,
  range: { from?: Date; to?: Date; includeDrafts?: boolean },
  page: PageRequest,
): Promise<{ items: Lean<JournalVoucherAttributes>[]; total: number }> => {
  const filter: QueryFilter<JournalVoucherAttributes> = {
    client: clientId,
    status: statusFilter(range.includeDrafts === true),
  };
  if (range.from || range.to) {
    filter.date = {
      ...(range.from ? { $gte: range.from } : {}),
      ...(range.to ? { $lte: range.to } : {}),
    };
  }
  const [items, total] = await Promise.all([
    JournalVoucher.find(filter)
      .sort({ date: 1, sequence: 1, _id: 1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate('lines.account', 'code name type subType')
      .lean<Lean<JournalVoucherAttributes>[]>()
      .exec(),
    JournalVoucher.countDocuments(filter).exec(),
  ]);
  return { items, total };
};

// ---------------------------------------------------------------------------
// Ledger (account statement)
// ---------------------------------------------------------------------------

export interface LedgerEntry {
  voucherId: string;
  voucherNo: string | null;
  date: Date;
  type: string;
  status: string;
  narration: string | null;
  description: string | null;
  debitPaise: number;
  creditPaise: number;
  balance: NaturalBalance;
}

export interface LedgerStatement {
  account: Lean<AccountAttributes>;
  from: Date | null;
  to: Date | null;
  opening: NaturalBalance;
  entries: LedgerEntry[];
  totals: { debitPaise: number; creditPaise: number };
  closing: NaturalBalance;
  total: number;
}

interface LineRow {
  _id: Types.ObjectId;
  voucherNo: string | null;
  date: Date;
  type: string;
  status: string;
  narration: string | null;
  description: string | null;
  debitPaise: number;
  creditPaise: number;
}

const openingFor = async (
  account: Lean<AccountAttributes>,
  before: Date | null,
  includeDrafts: boolean,
): Promise<{ debit: number; credit: number }> => {
  const ob = account.openingBalance;
  let debit = ob.isDebit ? ob.paise : 0;
  let credit = ob.isDebit ? 0 : ob.paise;
  if (before === null) return { debit, credit };

  const rows = await JournalVoucher.aggregate<{ debit: number; credit: number }>([
    {
      $match: {
        client: account.client,
        status: statusFilter(includeDrafts),
        date: { $lt: before },
        'lines.account': account._id,
      },
    },
    { $unwind: '$lines' },
    { $match: { 'lines.account': account._id } },
    {
      $group: {
        _id: null,
        debit: { $sum: '$lines.debitPaise' },
        credit: { $sum: '$lines.creditPaise' },
      },
    },
  ]).exec();
  const row = rows[0];
  if (row) {
    debit += row.debit;
    credit += row.credit;
  }
  return { debit, credit };
};

export const ledger = async (
  clientId: Types.ObjectId,
  accountId: Types.ObjectId,
  range: { from?: Date; to?: Date; includeDrafts?: boolean },
  page: PageRequest,
): Promise<LedgerStatement> => {
  const account = await Account.findOne({ _id: accountId, client: clientId })
    .lean<Lean<AccountAttributes>>()
    .exec();
  if (!account) throw notFound('account');
  const includeDrafts = range.includeDrafts === true;

  const match: Record<string, unknown> = {
    client: clientId,
    status: statusFilter(includeDrafts),
    'lines.account': accountId,
  };
  if (range.from || range.to) {
    match.date = {
      ...(range.from ? { $gte: range.from } : {}),
      ...(range.to ? { $lte: range.to } : {}),
    };
  }

  const pipeline: PipelineStage[] = [
    { $match: match },
    { $unwind: '$lines' },
    { $match: { 'lines.account': accountId } },
    { $sort: { date: 1, sequence: 1, _id: 1 } },
    {
      $project: {
        _id: 1,
        voucherNo: 1,
        date: 1,
        type: 1,
        status: 1,
        narration: 1,
        description: '$lines.description',
        debitPaise: '$lines.debitPaise',
        creditPaise: '$lines.creditPaise',
      },
    },
  ];

  // Running balance must include rows before this page, so we pull the
  // full ordered set for the range and slice. Ranges are bounded by design
  // (a ledger screen shows one account for one period).
  const rows = await JournalVoucher.aggregate<LineRow>(pipeline).exec();
  const opening = await openingFor(account, range.from ?? null, includeDrafts);

  let runDebit = opening.debit;
  let runCredit = opening.credit;
  let totalDebit = 0;
  let totalCredit = 0;
  const all: LedgerEntry[] = rows.map((row) => {
    runDebit += row.debitPaise;
    runCredit += row.creditPaise;
    totalDebit += row.debitPaise;
    totalCredit += row.creditPaise;
    return {
      voucherId: row._id.toString(),
      voucherNo: row.voucherNo,
      date: row.date,
      type: row.type,
      status: row.status,
      narration: row.narration,
      description: row.description,
      debitPaise: row.debitPaise,
      creditPaise: row.creditPaise,
      balance: naturalBalance(runDebit, runCredit),
    };
  });

  return {
    account,
    from: range.from ?? null,
    to: range.to ?? null,
    opening: naturalBalance(opening.debit, opening.credit),
    entries: all.slice(page.skip, page.skip + page.limit),
    totals: { debitPaise: totalDebit, creditPaise: totalCredit },
    closing: naturalBalance(runDebit, runCredit),
    total: all.length,
  };
};

// ---------------------------------------------------------------------------
// Trial balance
// ---------------------------------------------------------------------------

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  subType: string | null;
  isSystem: boolean;
  debitPaise: number;
  creditPaise: number;
  balance: NaturalBalance;
}

export interface TrialBalanceGroup {
  type: AccountType;
  debitPaise: number;
  creditPaise: number;
  rows: TrialBalanceRow[];
}

export interface TrialBalance {
  asOf: Date | null;
  includeDrafts: boolean;
  groups: TrialBalanceGroup[];
  totals: { debitPaise: number; creditPaise: number };
  /** Always true for a healthy set of books; surfaced so the UI can shout if not. */
  balanced: boolean;
}

export const trialBalance = async (
  clientId: Types.ObjectId,
  options: { asOf?: Date; includeDrafts?: boolean },
): Promise<TrialBalance> => {
  const includeDrafts = options.includeDrafts === true;
  const cacheKey = createCacheKey(
    'books',
    clientId.toString(),
    'tb',
    options.asOf?.toISOString() ?? 'all',
    includeDrafts ? 'drafts' : 'posted',
  );
  const cached = cache.get<TrialBalance>(cacheKey);
  if (cached) return cached;

  const accounts = await Account.find({ client: clientId })
    .sort({ type: 1, code: 1 })
    .lean<Lean<AccountAttributes>[]>()
    .exec();

  const match: Record<string, unknown> = {
    client: clientId,
    status: statusFilter(includeDrafts),
  };
  if (options.asOf) match.date = { $lte: options.asOf };

  const sums = await JournalVoucher.aggregate<{
    _id: Types.ObjectId;
    debit: number;
    credit: number;
  }>([
    { $match: match },
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.account',
        debit: { $sum: '$lines.debitPaise' },
        credit: { $sum: '$lines.creditPaise' },
      },
    },
  ]).exec();
  const byAccount = new Map(sums.map((row) => [row._id.toString(), row]));

  const groups: TrialBalanceGroup[] = ACCOUNT_TYPES.map((type) => ({
    type,
    debitPaise: 0,
    creditPaise: 0,
    rows: [],
  }));
  const groupFor = new Map(groups.map((group) => [group.type, group]));

  let totalDebit = 0;
  let totalCredit = 0;
  for (const account of accounts) {
    const ob = account.openingBalance;
    const obApplies = !options.asOf || ob.asOf.getTime() <= options.asOf.getTime();
    let debit = obApplies && ob.isDebit ? ob.paise : 0;
    let credit = obApplies && !ob.isDebit ? ob.paise : 0;
    const movement = byAccount.get(account._id.toString());
    if (movement) {
      debit += movement.debit;
      credit += movement.credit;
    }
    if (debit === 0 && credit === 0 && !account.isActive) continue;

    const balance = naturalBalance(debit, credit);
    const row: TrialBalanceRow = {
      accountId: account._id.toString(),
      code: account.code,
      name: account.name,
      type: account.type,
      subType: account.subType ?? null,
      isSystem: account.isSystem,
      debitPaise: balance.isDebit ? balance.paise : 0,
      creditPaise: balance.isDebit ? 0 : balance.paise,
      balance,
    };
    const group = groupFor.get(account.type);
    if (!group) continue;
    group.rows.push(row);
    group.debitPaise += row.debitPaise;
    group.creditPaise += row.creditPaise;
    totalDebit += row.debitPaise;
    totalCredit += row.creditPaise;
  }

  const result: TrialBalance = {
    asOf: options.asOf ?? null,
    includeDrafts,
    groups,
    totals: { debitPaise: totalDebit, creditPaise: totalCredit },
    balanced: totalDebit === totalCredit,
  };
  cache.set(cacheKey, result, 30_000);
  return result;
};
