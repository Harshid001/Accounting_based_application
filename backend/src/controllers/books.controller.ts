import { Types } from 'mongoose';

import { buildCsv, csvFilename } from '../lib/csv.js';
import { formatDateOnly } from '../lib/date.js';
import { sendCreated, sendCsv, sendData, sendList, sendNoContent } from '../lib/http.js';
import { buildPageMeta, toPageRequest } from '../lib/pagination.js';
import type { RouteContext } from '../middleware/validate.js';
import {
  serialiseAccount,
  serialiseBooksStatus,
  serialiseLedger,
  serialisePeriodLock,
  serialiseTrialBalance,
  serialiseVoucher,
} from '../serializers/books.serializer.js';
import { recordAudit } from '../services/audit.service.js';
import {
  createAccount,
  createDraftVoucher,
  deleteDraftVoucher,
  getAccount,
  getBooksStatus,
  getVoucher,
  listAccounts,
  listPeriodLocks,
  listVouchers,
  lockPeriod,
  postVoucher,
  reverseVoucher,
  updateAccount,
  updateDraftVoucher,
} from '../services/books.service.js';
import { dayBook, ledger, trialBalance } from '../services/booksReports.service.js';
import type {
  AccountListQuery,
  CreateAccountBody,
  CreateVoucherBody,
  DayBookQuery,
  LedgerQuery,
  LockPeriodBody,
  ReverseVoucherBody,
  TrialBalanceQuery,
  UpdateAccountBody,
  UpdateVoucherBody,
  VoucherListQuery,
} from '../validators/books.validators.js';

type IdParams = { params: { id: string } };

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export const accountsList = async (
  input: { query: AccountListQuery },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const { items, total } = await listAccounts(ctx.clientId(), input.query, page);
  sendList(ctx.res, items.map(serialiseAccount), buildPageMeta(total, page));
};

export const accountDetail = async (input: IdParams, ctx: RouteContext): Promise<void> => {
  sendData(ctx.res, serialiseAccount(await getAccount(new Types.ObjectId(input.params.id))));
};

export const accountCreate = async (
  input: { body: CreateAccountBody },
  ctx: RouteContext,
): Promise<void> => {
  const { clientId: _clientId, ...body } = input.body;
  const account = await createAccount(ctx.clientId(), body, ctx.actor);
  sendCreated(ctx.res, serialiseAccount(account));
};

export const accountUpdate = async (
  input: IdParams & { body: UpdateAccountBody },
  ctx: RouteContext,
): Promise<void> => {
  const account = await updateAccount(
    new Types.ObjectId(input.params.id),
    input.body,
    ctx.actor,
  );
  sendData(ctx.res, serialiseAccount(account));
};

// ---------------------------------------------------------------------------
// Vouchers
// ---------------------------------------------------------------------------

export const vouchersList = async (
  input: { query: VoucherListQuery },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const { items, total } = await listVouchers(ctx.clientId(), input.query, page);
  sendList(ctx.res, items.map(serialiseVoucher), buildPageMeta(total, page));
};

export const voucherDetail = async (input: IdParams, ctx: RouteContext): Promise<void> => {
  sendData(ctx.res, serialiseVoucher(await getVoucher(new Types.ObjectId(input.params.id))));
};

export const voucherCreate = async (
  input: { body: CreateVoucherBody },
  ctx: RouteContext,
): Promise<void> => {
  const { clientId: _clientId, ...body } = input.body;
  const voucher = await createDraftVoucher(ctx.clientId(), body, ctx.actor);
  sendCreated(ctx.res, serialiseVoucher(voucher));
};

export const voucherUpdate = async (
  input: IdParams & { body: UpdateVoucherBody },
  ctx: RouteContext,
): Promise<void> => {
  const voucher = await updateDraftVoucher(
    new Types.ObjectId(input.params.id),
    input.body,
    ctx.actor,
  );
  sendData(ctx.res, serialiseVoucher(voucher));
};

export const voucherDelete = async (input: IdParams, ctx: RouteContext): Promise<void> => {
  await deleteDraftVoucher(new Types.ObjectId(input.params.id), ctx.actor);
  sendNoContent(ctx.res);
};

export const voucherPost = async (input: IdParams, ctx: RouteContext): Promise<void> => {
  const voucher = await postVoucher(new Types.ObjectId(input.params.id), ctx.actor);
  sendData(ctx.res, serialiseVoucher(voucher));
};

export const voucherReverse = async (
  input: IdParams & { body: ReverseVoucherBody },
  ctx: RouteContext,
): Promise<void> => {
  const voucher = await reverseVoucher(
    new Types.ObjectId(input.params.id),
    input.body.reason,
    input.body.date,
    ctx.actor,
  );
  sendCreated(ctx.res, serialiseVoucher(voucher));
};

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const dayBookReport = async (
  input: { query: DayBookQuery },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const { items, total } = await dayBook(ctx.clientId(), input.query, page);
  sendList(ctx.res, items.map(serialiseVoucher), buildPageMeta(total, page));
};

export const ledgerReport = async (
  input: { query: LedgerQuery },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const statement = await ledger(
    ctx.clientId(),
    new Types.ObjectId(input.query.account),
    input.query,
    page,
  );
  sendData(ctx.res, serialiseLedger(statement), { ...buildPageMeta(statement.total, page) });
};

export const trialBalanceReport = async (
  input: { query: TrialBalanceQuery },
  ctx: RouteContext,
): Promise<void> => {
  const tb = await trialBalance(ctx.clientId(), input.query);
  sendData(ctx.res, serialiseTrialBalance(tb));
};

export const trialBalanceCsv = async (
  input: { query: TrialBalanceQuery },
  ctx: RouteContext,
): Promise<void> => {
  const tb = await trialBalance(ctx.clientId(), input.query);
  const rows = tb.groups.flatMap((group) => group.rows);
  const csv = buildCsv(rows, [
    { header: 'Code', value: (row) => row.code },
    { header: 'Account', value: (row) => row.name },
    { header: 'Type', value: (row) => row.type },
    { header: 'Debit', value: (row) => (row.debitPaise / 100).toFixed(2) },
    { header: 'Credit', value: (row) => (row.creditPaise / 100).toFixed(2) },
  ]);
  await recordAudit({
    actor: ctx.actor,
    action: 'export',
    entityKind: 'journalVoucher',
    client: ctx.clientId(),
    summary: `Exported trial balance${tb.asOf ? ` as of ${formatDateOnly(tb.asOf) ?? ''}` : ''}`,
  });
  sendCsv(ctx.res, csvFilename('firmdesk-trial-balance'), csv);
};

// ---------------------------------------------------------------------------
// Locks & status
// ---------------------------------------------------------------------------

export const locksList = async (
  _input: { query: { client: string } },
  ctx: RouteContext,
): Promise<void> => {
  const locks = await listPeriodLocks(ctx.clientId());
  sendData(ctx.res, locks.map(serialisePeriodLock));
};

export const lockCreate = async (
  input: { params: { period: string }; body: LockPeriodBody },
  ctx: RouteContext,
): Promise<void> => {
  const lock = await lockPeriod(
    ctx.clientId(),
    input.params.period,
    input.body.confirm,
    input.body.note,
    ctx.actor,
  );
  sendCreated(ctx.res, serialisePeriodLock(lock));
};

export const status = async (
  _input: { query: { client: string } },
  ctx: RouteContext,
): Promise<void> => {
  sendData(ctx.res, serialiseBooksStatus(await getBooksStatus(ctx.clientId())));
};
