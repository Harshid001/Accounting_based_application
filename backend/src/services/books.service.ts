import type { QueryFilter } from 'mongoose';
import { Types } from 'mongoose';

import {
  fyLabelFor,
  formatVoucherNo,
  lockCovering,
  materialiseVoucher,
  resolveLockPeriod,
  reversalLines,
} from '../lib/books.js';
import type { AccountInfo, LineInput, LockWindow, SystemAccountMap } from '../lib/books.js';
import { cache, createCacheKey } from '../lib/cache.js';
import { addDays, todayIST } from '../lib/date.js';
import { SYSTEM_ACCOUNT_SUB_TYPES } from '../lib/enums.js';
import type { SystemAccountSubType, VoucherSource, VoucherType } from '../lib/enums.js';
import { conflict, notFound, validationFailed } from '../lib/errors.js';
import type { PageRequest } from '../lib/pagination.js';
import { parseSort, withTiebreak } from '../lib/pagination.js';
import type { AccountAttributes, AccountDocument } from '../models/ledgerAccount.model.js';
import { Account } from '../models/ledgerAccount.model.js';
import { Client } from '../models/client.model.js';
import type {
  JournalVoucherAttributes,
  JournalVoucherDocument,
  VoucherLineAttributes,
} from '../models/journalVoucher.model.js';
import { JournalVoucher } from '../models/journalVoucher.model.js';
import type { PeriodLockAttributes } from '../models/periodLock.model.js';
import { PeriodLock } from '../models/periodLock.model.js';
import { VoucherSequence } from '../models/voucherSequence.model.js';
import type { RequestActor } from '../types/context.js';
import type { Lean } from '../types/lean.js';
import type {
  AccountListQuery,
  CreateAccountBody,
  UpdateAccountBody,
  VoucherLineInput,
  VoucherListQuery,
} from '../validators/books.validators.js';
import { buildDiff, recordAudit } from './audit.service.js';

// ---------------------------------------------------------------------------
// System (engine-owned) accounts
// ---------------------------------------------------------------------------

interface SystemAccountSpec {
  code: string;
  name: string;
  type: AccountAttributes['type'];
}

const SYSTEM_ACCOUNT_SPECS: Record<SystemAccountSubType, SystemAccountSpec> = {
  gst_output: { code: 'SYS-GST-OUT', name: 'GST Output Tax', type: 'liability' },
  gst_input: { code: 'SYS-GST-IN', name: 'GST Input Tax Credit', type: 'asset' },
  tds_payable: { code: 'SYS-TDS-PAY', name: 'TDS Payable', type: 'liability' },
  tds_receivable: { code: 'SYS-TDS-REC', name: 'TDS Receivable', type: 'asset' },
  rounding: { code: 'SYS-ROUND', name: 'Rounding Off', type: 'expense' },
};

const isSystemSubType = (value: string | null | undefined): value is SystemAccountSubType =>
  value !== null &&
  value !== undefined &&
  (SYSTEM_ACCOUNT_SUB_TYPES as readonly string[]).includes(value);

const invalidateBooks = (clientId: Types.ObjectId): void => {
  cache.invalidatePrefix(createCacheKey('books', clientId.toString()));
};

/**
 * Idempotently creates the engine's duty/rounding accounts for a client and
 * returns a subType -> accountId map. Called on first use of the books.
 */
export const ensureSystemAccounts = async (
  clientId: Types.ObjectId,
  actor: RequestActor,
): Promise<SystemAccountMap> => {
  const existing = await Account.find({ client: clientId, isSystem: true })
    .select('_id subType')
    .lean()
    .exec();
  const map = new Map<string, Types.ObjectId>();
  for (const account of existing) {
    if (isSystemSubType(account.subType)) map.set(account.subType, account._id);
  }

  const asOf = todayIST();
  for (const subType of SYSTEM_ACCOUNT_SUB_TYPES) {
    if (map.has(subType)) continue;
    const spec = SYSTEM_ACCOUNT_SPECS[subType];
    try {
      const doc = await Account.create({
        client: clientId,
        code: spec.code,
        name: spec.name,
        type: spec.type,
        subType,
        openingBalance: { paise: 0, asOf, isDebit: spec.type === 'asset' },
        isActive: true,
        isSystem: true,
        createdBy: actor.id,
        updatedBy: actor.id,
      });
      map.set(subType, doc._id);
    } catch {
      // A concurrent request created it first; read it back.
      const doc = await Account.findOne({ client: clientId, isSystem: true, subType })
        .select('_id')
        .lean()
        .exec();
      if (!doc) throw conflict('Could not initialise the engine accounts for this client.');
      map.set(subType, doc._id);
    }
  }

  const out = {} as SystemAccountMap;
  for (const subType of SYSTEM_ACCOUNT_SUB_TYPES) {
    const id = map.get(subType);
    if (!id) throw conflict('Engine accounts are incomplete for this client.');
    out[subType] = id.toString();
  }
  return out;
};

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export const ACCOUNT_SORT_FIELDS = ['code', 'name', 'type', 'createdAt'] as const;

export const clientIdOfAccount = async (id: Types.ObjectId): Promise<Types.ObjectId | null> => {
  const record = await Account.findById(id).select('client').lean().exec();
  return record?.client ?? null;
};

export const listAccounts = async (
  clientId: Types.ObjectId,
  query: Omit<AccountListQuery, 'client' | 'page' | 'limit'>,
  page: PageRequest,
): Promise<{ items: Lean<AccountAttributes>[]; total: number }> => {
  const filter: QueryFilter<AccountAttributes> = { client: clientId };
  if (query.type) filter.type = query.type;
  if (query.subType) filter.subType = query.subType;
  if (query.includeInactive !== true) filter.isActive = true;
  if (query.q) {
    const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: new RegExp(escaped, 'i') }, { code: new RegExp(escaped, 'i') }];
  }
  const sort = withTiebreak(
    parseSort<(typeof ACCOUNT_SORT_FIELDS)[number]>(query.sort, ACCOUNT_SORT_FIELDS, {
      code: 1,
    }),
  );
  const [items, total] = await Promise.all([
    Account.find(filter)
      .sort(sort)
      .skip(page.skip)
      .limit(page.limit)
      .lean<Lean<AccountAttributes>[]>()
      .exec(),
    Account.countDocuments(filter).exec(),
  ]);
  return { items, total };
};

export const getAccount = async (id: Types.ObjectId): Promise<Lean<AccountAttributes>> => {
  const record = await Account.findById(id).lean<Lean<AccountAttributes>>().exec();
  if (!record) throw notFound('account');
  return record;
};

const assertParent = async (
  clientId: Types.ObjectId,
  parentId: string | null | undefined,
  selfId?: Types.ObjectId,
): Promise<Types.ObjectId | null> => {
  if (parentId === null || parentId === undefined) return null;
  const parent = new Types.ObjectId(parentId);
  if (selfId && parent.equals(selfId)) {
    throw validationFailed('An account cannot be its own parent.', [
      { field: 'parentId', message: 'Choose a different parent.' },
    ]);
  }
  const exists = await Account.exists({ _id: parent, client: clientId }).exec();
  if (!exists) {
    throw validationFailed('The parent account does not exist for this client.', [
      { field: 'parentId', message: 'Choose an account from this client.' },
    ]);
  }
  return parent;
};

const normaliseParty = (
  party: CreateAccountBody['party'],
): AccountAttributes['party'] | undefined => {
  if (party === undefined) return undefined;
  if (party === null) return null;
  return {
    gstin: party.gstin ? party.gstin : null,
    pan: party.pan ? party.pan : null,
  };
};

export const createAccount = async (
  clientId: Types.ObjectId,
  body: Omit<CreateAccountBody, 'clientId'>,
  actor: RequestActor,
): Promise<Lean<AccountAttributes>> => {
  if (isSystemSubType(body.subType)) {
    throw validationFailed('That sub-type is reserved for engine-managed duty accounts.', [
      { field: 'subType', message: 'Choose a different sub-type.' },
    ]);
  }
  const parent = await assertParent(clientId, body.parentId);
  const duplicate = await Account.exists({ client: clientId, code: body.code }).exec();
  if (duplicate) {
    throw conflict(`Account code ${body.code} is already in use for this client.`, [
      { field: 'code', message: 'Choose a unique code.' },
    ]);
  }
  const doc = await Account.create({
    client: clientId,
    code: body.code,
    name: body.name,
    type: body.type,
    subType: body.subType ?? null,
    parent,
    party: normaliseParty(body.party) ?? null,
    openingBalance: body.openingBalance ?? { paise: 0, asOf: todayIST(), isDebit: true },
    isActive: true,
    isSystem: false,
    createdBy: actor.id,
    updatedBy: actor.id,
  });
  await recordAudit({
    actor,
    action: 'create',
    entityKind: 'account',
    entityId: doc._id,
    client: clientId,
    summary: `Created account ${doc.code} ${doc.name}`,
  });
  invalidateBooks(clientId);
  return getAccount(doc._id);
};

const ACCOUNT_AUDIT_FIELDS = [
  'name',
  'subType',
  'parent',
  'party',
  'openingBalance',
  'isActive',
] as const;

const accountSnapshot = (doc: AccountDocument): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const field of ACCOUNT_AUDIT_FIELDS) out[field] = doc.get(field);
  return out;
};

export const updateAccount = async (
  id: Types.ObjectId,
  body: UpdateAccountBody,
  actor: RequestActor,
): Promise<Lean<AccountAttributes>> => {
  const doc = await Account.findById(id).exec();
  if (!doc) throw notFound('account');
  if (doc.isSystem && (body.subType !== undefined || body.isActive === false)) {
    throw conflict('Engine-managed accounts keep their sub-type and stay active.');
  }
  if (isSystemSubType(body.subType)) {
    throw validationFailed('That sub-type is reserved for engine-managed duty accounts.', [
      { field: 'subType', message: 'Choose a different sub-type.' },
    ]);
  }
  const before = accountSnapshot(doc);
  if (body.name !== undefined) doc.set('name', body.name);
  if (body.subType !== undefined) doc.set('subType', body.subType);
  if (body.parentId !== undefined)
    doc.set('parent', await assertParent(doc.client, body.parentId, id));
  const party = normaliseParty(body.party);
  if (party !== undefined) doc.set('party', party);
  if (body.openingBalance !== undefined) doc.set('openingBalance', body.openingBalance);
  if (body.isActive !== undefined) doc.set('isActive', body.isActive);
  doc.set('updatedBy', actor.id);
  await doc.save();

  const diff = buildDiff(before, accountSnapshot(doc));
  if (diff.length > 0) {
    await recordAudit({
      actor,
      action: 'update',
      entityKind: 'account',
      entityId: doc._id,
      client: doc.client,
      summary: `Updated account ${doc.code} ${doc.name}`,
      diff,
    });
  }
  invalidateBooks(doc.client);
  return getAccount(doc._id);
};

// ---------------------------------------------------------------------------
// Period locks
// ---------------------------------------------------------------------------

export const listPeriodLocks = async (
  clientId: Types.ObjectId,
): Promise<Lean<PeriodLockAttributes>[]> =>
  PeriodLock.find({ client: clientId })
    .sort({ periodStart: -1 })
    .lean<Lean<PeriodLockAttributes>[]>()
    .exec();

const lockWindows = async (clientId: Types.ObjectId): Promise<LockWindow[]> => {
  const locks = await PeriodLock.find({ client: clientId })
    .select('period kind periodStart periodEnd')
    .lean()
    .exec();
  return locks.map((lock) => ({
    period: lock.period,
    kind: lock.kind,
    periodStart: lock.periodStart,
    periodEnd: lock.periodEnd,
  }));
};

const assertOpenPeriod = async (clientId: Types.ObjectId, date: Date): Promise<void> => {
  const lock = lockCovering(date, await lockWindows(clientId));
  if (lock) {
    throw conflict(
      `${lock.period} is locked. Entries dated inside a locked period cannot be posted; use a reversal dated in an open period instead.`,
    );
  }
};

/** Earliest date on/after `preferred` that is not inside any lock. */
const earliestOpenDate = (preferred: Date, locks: readonly LockWindow[]): Date => {
  let candidate = preferred;
  for (let guard = 0; guard < 120; guard += 1) {
    const lock = lockCovering(candidate, locks);
    if (!lock) return candidate;
    candidate = addDays(lock.periodEnd, 1);
  }
  throw conflict('Could not find an open period to date this entry.');
};

export const lockPeriod = async (
  clientId: Types.ObjectId,
  periodInput: string,
  confirm: string,
  note: string | null | undefined,
  actor: RequestActor,
): Promise<Lean<PeriodLockAttributes>> => {
  const window = resolveLockPeriod(periodInput);
  const expected = `LOCK ${window.period.replace(/^FY\s+/, '')}`;
  if (confirm.trim().toUpperCase() !== expected.toUpperCase()) {
    throw validationFailed(`Type "${expected}" exactly to confirm this lock.`, [
      { field: 'confirm', message: `Type "${expected}" to confirm.` },
    ]);
  }
  const existing = await PeriodLock.findOne({ client: clientId, period: window.period })
    .lean<Lean<PeriodLockAttributes>>()
    .exec();
  if (existing) throw conflict(`${window.period} is already locked.`);

  const draftCount = await JournalVoucher.countDocuments({
    client: clientId,
    status: 'draft',
    date: { $gte: window.periodStart, $lte: window.periodEnd },
  }).exec();
  if (draftCount > 0) {
    throw conflict(
      `${draftCount} draft voucher${draftCount === 1 ? '' : 's'} still dated inside ${window.period}. Post or delete them before locking.`,
    );
  }

  const lockedAt = new Date();
  const lock = await PeriodLock.create({
    client: clientId,
    period: window.period,
    kind: window.kind,
    periodStart: window.periodStart,
    periodEnd: window.periodEnd,
    lockedAt,
    lockedBy: actor.id,
    note: note ?? null,
  });
  await JournalVoucher.updateMany(
    {
      client: clientId,
      status: 'posted',
      date: { $gte: window.periodStart, $lte: window.periodEnd },
    },
    { $set: { status: 'locked', lockedAt } },
  ).exec();

  await recordAudit({
    actor,
    action: 'lock_period',
    entityKind: 'periodLock',
    entityId: lock._id,
    client: clientId,
    summary: `Locked ${window.period}`,
  });
  invalidateBooks(clientId);
  return lock.toObject();
};

// ---------------------------------------------------------------------------
// Vouchers
// ---------------------------------------------------------------------------

export const VOUCHER_SORT_FIELDS = ['date', 'voucherNo', 'createdAt', 'totalPaise'] as const;

export const clientIdOfVoucher = async (id: Types.ObjectId): Promise<Types.ObjectId | null> => {
  const record = await JournalVoucher.findById(id).select('client').lean().exec();
  return record?.client ?? null;
};

export const getVoucher = async (
  id: Types.ObjectId,
): Promise<Lean<JournalVoucherAttributes>> => {
  const record = await JournalVoucher.findById(id)
    .populate('lines.account', 'code name type subType')
    .lean<Lean<JournalVoucherAttributes>>()
    .exec();
  if (!record) throw notFound('voucher');
  return record;
};

export const listVouchers = async (
  clientId: Types.ObjectId,
  query: Omit<VoucherListQuery, 'client' | 'page' | 'limit'>,
  page: PageRequest,
): Promise<{ items: Lean<JournalVoucherAttributes>[]; total: number }> => {
  const filter: QueryFilter<JournalVoucherAttributes> = { client: clientId };
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;
  if (query.source) filter.source = query.source;
  if (query.account) filter['lines.account'] = new Types.ObjectId(query.account);
  if (query.from || query.to) {
    filter.date = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }
  if (query.q) {
    const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped, 'i');
    filter.$or = [{ voucherNo: pattern }, { narration: pattern }, { reference: pattern }];
  }
  const sort = withTiebreak(
    parseSort<(typeof VOUCHER_SORT_FIELDS)[number]>(query.sort, VOUCHER_SORT_FIELDS, {
      date: -1,
    }),
  );
  const [items, total] = await Promise.all([
    JournalVoucher.find(filter)
      .sort(sort)
      .skip(page.skip)
      .limit(page.limit)
      .populate('lines.account', 'code name type subType')
      .lean<Lean<JournalVoucherAttributes>[]>()
      .exec(),
    JournalVoucher.countDocuments(filter).exec(),
  ]);
  return { items, total };
};

const loadAccountInfo = async (
  clientId: Types.ObjectId,
  ids: readonly string[],
  system: SystemAccountMap,
): Promise<Map<string, AccountInfo>> => {
  const wanted = new Set<string>([...ids, ...Object.values(system)]);
  const accounts = await Account.find({
    client: clientId,
    _id: { $in: [...wanted].map((id) => new Types.ObjectId(id)) },
  })
    .select('_id name type subType isActive isSystem')
    .lean()
    .exec();
  const map = new Map<string, AccountInfo>();
  for (const account of accounts) {
    map.set(account._id.toString(), {
      id: account._id.toString(),
      name: account.name,
      type: account.type,
      subType: account.subType ?? null,
      isActive: account.isActive,
      isSystemDuty: account.isSystem,
    });
  }
  return map;
};

const toLineInputs = (lines: readonly VoucherLineInput[]): LineInput[] =>
  lines.map((line) => ({
    accountId: line.accountId,
    debitPaise: line.debitPaise,
    creditPaise: line.creditPaise,
    description: line.description ?? null,
    tax: line.tax ?? null,
  }));

const toStoredLines = (
  lines: ReturnType<typeof materialiseVoucher>['lines'],
): VoucherLineAttributes[] =>
  lines.map((line) => ({
    account: new Types.ObjectId(line.accountId),
    debitPaise: line.debitPaise,
    creditPaise: line.creditPaise,
    description: line.description,
    tax: line.tax ?? null,
    isDerived: line.isDerived,
  }));

/** Runs the engine on caller lines and returns the storable shape. */
const buildVoucherLines = async (
  clientId: Types.ObjectId,
  lines: readonly VoucherLineInput[],
  actor: RequestActor,
): Promise<ReturnType<typeof materialiseVoucher>> => {
  const system = await ensureSystemAccounts(clientId, actor);
  const accounts = await loadAccountInfo(
    clientId,
    lines.map((line) => line.accountId),
    system,
  );
  return materialiseVoucher(toLineInputs(lines), accounts, system);
};

export interface CreateVoucherInput {
  date: Date;
  type: VoucherType;
  narration?: string | null;
  reference?: string | null;
  source: Exclude<VoucherSource, 'reversal'>;
  lines: VoucherLineInput[];
}

export const createDraftVoucher = async (
  clientId: Types.ObjectId,
  input: CreateVoucherInput,
  actor: RequestActor,
): Promise<Lean<JournalVoucherAttributes>> => {
  const built = await buildVoucherLines(clientId, input.lines, actor);
  const doc = await JournalVoucher.create({
    client: clientId,
    voucherNo: null,
    fyLabel: fyLabelFor(input.date),
    sequence: null,
    date: input.date,
    type: input.type,
    narration: input.narration ?? null,
    reference: input.reference ?? null,
    status: 'draft',
    source: input.source,
    lines: toStoredLines(built.lines),
    derived: built.derived,
    totalPaise: built.totalPaise,
    createdBy: actor.id,
    updatedBy: actor.id,
  });
  await recordAudit({
    actor,
    action: 'create',
    entityKind: 'journalVoucher',
    entityId: doc._id,
    client: clientId,
    summary: `Drafted ${input.type} voucher for ${formatTotal(built.totalPaise)}`,
  });
  invalidateBooks(clientId);
  return getVoucher(doc._id);
};

const formatTotal = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN')}`;

export interface UpdateVoucherInput {
  date?: Date;
  type?: VoucherType;
  narration?: string | null;
  reference?: string | null;
  lines?: VoucherLineInput[];
}

const requireDraft = async (id: Types.ObjectId): Promise<JournalVoucherDocument> => {
  const doc = await JournalVoucher.findById(id).exec();
  if (!doc) throw notFound('voucher');
  if (doc.status !== 'draft') {
    const label = doc.voucherNo ? `Voucher ${doc.voucherNo}` : 'This voucher';
    throw conflict(
      `${label} is ${doc.status} and cannot be edited. Post a reversal to correct it.`,
    );
  }
  return doc;
};

export const updateDraftVoucher = async (
  id: Types.ObjectId,
  input: UpdateVoucherInput,
  actor: RequestActor,
): Promise<Lean<JournalVoucherAttributes>> => {
  const doc = await requireDraft(id);
  const before = {
    date: doc.date,
    type: doc.type,
    narration: doc.narration,
    reference: doc.reference,
    totalPaise: doc.totalPaise,
  };
  if (input.date !== undefined) {
    doc.set('date', input.date);
    doc.set('fyLabel', fyLabelFor(input.date));
  }
  if (input.type !== undefined) doc.set('type', input.type);
  if (input.narration !== undefined) doc.set('narration', input.narration);
  if (input.reference !== undefined) doc.set('reference', input.reference);
  if (input.lines !== undefined) {
    const built = await buildVoucherLines(doc.client, input.lines, actor);
    doc.set('lines', toStoredLines(built.lines));
    doc.set('derived', built.derived);
    doc.set('totalPaise', built.totalPaise);
  }
  doc.set('updatedBy', actor.id);
  await doc.save();

  const diff = buildDiff(before, {
    date: doc.date,
    type: doc.type,
    narration: doc.narration,
    reference: doc.reference,
    totalPaise: doc.totalPaise,
  });
  await recordAudit({
    actor,
    action: 'update',
    entityKind: 'journalVoucher',
    entityId: doc._id,
    client: doc.client,
    summary: `Edited draft voucher`,
    diff,
  });
  invalidateBooks(doc.client);
  return getVoucher(doc._id);
};

export const deleteDraftVoucher = async (
  id: Types.ObjectId,
  actor: RequestActor,
): Promise<void> => {
  const doc = await requireDraft(id);
  await doc.deleteOne();
  await recordAudit({
    actor,
    action: 'hard_delete',
    entityKind: 'journalVoucher',
    entityId: id,
    client: doc.client,
    summary: `Deleted draft ${doc.type} voucher for ${formatTotal(doc.totalPaise)}`,
  });
  invalidateBooks(doc.client);
};

const nextSequence = async (clientId: Types.ObjectId, fyLabel: string): Promise<number> => {
  const counter = await VoucherSequence.findOneAndUpdate(
    { client: clientId, fyLabel },
    { $inc: { last: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )
    .lean()
    .exec();
  if (!counter) throw conflict('Could not allocate a voucher number.');
  return counter.last;
};

/**
 * Draft -> posted. Re-validates every invariant against the current chart of
 * accounts, enforces period locks, and draws the next voucher number
 * atomically. Posted vouchers are immutable from here on.
 */
export const postVoucher = async (
  id: Types.ObjectId,
  actor: RequestActor,
): Promise<Lean<JournalVoucherAttributes>> => {
  const doc = await requireDraft(id);
  await assertOpenPeriod(doc.client, doc.date);

  // Re-run the engine on the base lines so a stale draft cannot post with
  // an inactive account or outdated duty mapping.
  const baseLines: VoucherLineInput[] = doc.lines
    .filter((line) => !line.isDerived)
    .map((line) => ({
      accountId: line.account.toString(),
      debitPaise: line.debitPaise,
      creditPaise: line.creditPaise,
      description: line.description ?? null,
      tax: line.tax ?? null,
    }));
  const built = await buildVoucherLines(doc.client, baseLines, actor);

  const fyLabel = fyLabelFor(doc.date);
  const sequence = await nextSequence(doc.client, fyLabel);
  const voucherNo = formatVoucherNo(fyLabel, sequence);
  const postedAt = new Date();

  // Guard against a concurrent post of the same draft: only flip if still draft.
  const updated = await JournalVoucher.findOneAndUpdate(
    { _id: doc._id, status: 'draft' },
    {
      $set: {
        status: 'posted',
        fyLabel,
        sequence,
        voucherNo,
        lines: toStoredLines(built.lines),
        derived: built.derived,
        totalPaise: built.totalPaise,
        postedBy: actor.id,
        postedAt,
        updatedBy: actor.id,
      },
    },
    { new: true, runValidators: true },
  ).exec();
  if (!updated) throw conflict('This voucher was already posted by someone else.');

  if (updated.reversalOf) {
    await JournalVoucher.updateOne(
      { _id: updated.reversalOf, status: { $in: ['posted', 'locked'] } },
      { $set: { status: 'reversed', reversedBy: updated._id, updatedBy: actor.id } },
    ).exec();
  }

  await recordAudit({
    actor,
    action: 'post',
    entityKind: 'journalVoucher',
    entityId: updated._id,
    client: updated.client,
    summary: `Posted ${voucherNo} (${updated.type}) for ${formatTotal(updated.totalPaise)}`,
  });
  invalidateBooks(updated.client);
  return getVoucher(updated._id);
};

/**
 * Creates a reversal *draft* mirroring a posted/locked voucher. The reversal
 * is dated on the requested date or, if that period is locked, the earliest
 * open date after it. The original flips to 'reversed' when the draft posts.
 */
export const reverseVoucher = async (
  id: Types.ObjectId,
  reason: string,
  requestedDate: Date | undefined,
  actor: RequestActor,
): Promise<Lean<JournalVoucherAttributes>> => {
  const original = await JournalVoucher.findById(id).exec();
  if (!original) throw notFound('voucher');
  if (original.status === 'draft') {
    throw conflict('Drafts are edited or deleted directly; only posted vouchers are reversed.');
  }
  if (original.status === 'reversed') {
    throw conflict(`${original.voucherNo ?? 'This voucher'} has already been reversed.`);
  }
  const pending = await JournalVoucher.exists({
    reversalOf: original._id,
    status: 'draft',
  }).exec();
  if (pending) {
    throw conflict(
      'A reversal draft already exists for this voucher. Post or delete it first.',
    );
  }

  const locks = await lockWindows(original.client);
  const preferred = requestedDate ?? (todayIST() > original.date ? todayIST() : original.date);
  const date = earliestOpenDate(preferred < original.date ? original.date : preferred, locks);

  const mirrored = reversalLines(
    original.lines.map((line) => ({
      accountId: line.account.toString(),
      debitPaise: line.debitPaise,
      creditPaise: line.creditPaise,
      description: line.description ?? null,
      tax: line.tax ?? null,
      isDerived: line.isDerived,
    })),
  );

  const doc = await JournalVoucher.create({
    client: original.client,
    voucherNo: null,
    fyLabel: fyLabelFor(date),
    sequence: null,
    date,
    type: original.type,
    narration: `Reversal of ${original.voucherNo ?? 'voucher'}: ${reason}`,
    reference: original.voucherNo ?? null,
    status: 'draft',
    source: 'reversal',
    lines: toStoredLines(mirrored),
    derived: original.derived,
    totalPaise: original.totalPaise,
    reversalOf: original._id,
    createdBy: actor.id,
    updatedBy: actor.id,
  });
  await recordAudit({
    actor,
    action: 'reverse',
    entityKind: 'journalVoucher',
    entityId: original._id,
    client: original.client,
    summary: `Drafted reversal of ${original.voucherNo ?? 'voucher'}: ${reason}`,
  });
  invalidateBooks(original.client);
  return getVoucher(doc._id);
};

// ---------------------------------------------------------------------------
// Status summary
// ---------------------------------------------------------------------------

export interface BooksStatus {
  booksMode: 'native' | 'tally' | 'hybrid';
  tallyConfig: { companyName: string; edition: string } | null;
  accounts: number;
  vouchers: Record<'draft' | 'posted' | 'reversed' | 'locked', number>;
  locks: Lean<PeriodLockAttributes>[];
  lastPostedAt: Date | null;
}

export const getBooksStatus = async (clientId: Types.ObjectId): Promise<BooksStatus> => {
  const client = await Client.findById(clientId).select('booksMode tallyConfig').lean().exec();
  if (!client) throw notFound('client');
  const [accounts, counts, locks, last] = await Promise.all([
    Account.countDocuments({ client: clientId, isActive: true }).exec(),
    JournalVoucher.aggregate<{ _id: string; count: number }>([
      { $match: { client: clientId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).exec(),
    listPeriodLocks(clientId),
    JournalVoucher.findOne({ client: clientId, postedAt: { $ne: null } })
      .sort({ postedAt: -1 })
      .select('postedAt')
      .lean()
      .exec(),
  ]);
  const vouchers = { draft: 0, posted: 0, reversed: 0, locked: 0 };
  for (const row of counts) {
    if (row._id in vouchers) vouchers[row._id as keyof typeof vouchers] = row.count;
  }
  return {
    booksMode: client.booksMode ?? 'native',
    tallyConfig: client.tallyConfig
      ? { companyName: client.tallyConfig.companyName, edition: client.tallyConfig.edition }
      : null,
    accounts,
    vouchers,
    locks,
    lastPostedAt: last?.postedAt ?? null,
  };
};
