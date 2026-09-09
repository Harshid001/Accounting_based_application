import { apiDelete, apiGet, apiList, apiPatch, apiPost, apiRequestFull } from '@/api/client';
import { csvFilename, downloadCsv } from '@/lib/download';
import type { Paged, QueryParams } from '@/types/api';
import type {
  AccountView,
  BooksStatusView,
  LedgerView,
  PeriodLockView,
  TallyBridgeStatus,
  TallyCommandResult,
  TallyImportResult,
  TrialBalanceView,
  VoucherView,
} from '@/types/models';

export const ACCOUNT_SORT_FIELDS = ['code', 'name', 'type', 'createdAt'] as const;
export const VOUCHER_SORT_FIELDS = ['date', 'voucherNo', 'createdAt', 'totalPaise'] as const;

// --- status ------------------------------------------------------------------

export const fetchBooksStatus = (clientId: string): Promise<BooksStatusView> =>
  apiGet<BooksStatusView>('/books/status', { client: clientId });

// --- Tally bridge -----------------------------------------------------------

export const fetchTallyBridgeStatus = (clientId: string): Promise<TallyBridgeStatus> =>
  apiGet<TallyBridgeStatus>('/books/tally/status', { client: clientId });

export const checkTallyConnection = (clientId: string): Promise<{ commandId: string; status: string }> =>
  apiPost<{ commandId: string; status: string }>('/books/tally/health', { clientId });

export const sendToTally = (
  clientId: string,
  voucherIds: string[],
): Promise<TallyCommandResult> =>
  apiPost<TallyCommandResult>('/books/tally/post', { clientId, voucherIds });

export const importTallyLedgers = (clientId: string): Promise<TallyImportResult> =>
  apiPost<TallyImportResult>('/books/tally/import-accounts', { clientId });

// --- accounts ----------------------------------------------------------------

export const listAccounts = (
  params: QueryParams,
  signal?: AbortSignal,
): Promise<Paged<AccountView>> =>
  apiList<AccountView>('/books/accounts', {
    method: 'GET',
    query: params,
    ...(signal ? { signal } : {}),
  });

export const getAccount = (id: string): Promise<AccountView> =>
  apiGet<AccountView>(`/books/accounts/${id}`);

export const createAccount = (body: unknown): Promise<AccountView> =>
  apiPost<AccountView>('/books/accounts', body);

export const updateAccount = (id: string, body: unknown): Promise<AccountView> =>
  apiPatch<AccountView>(`/books/accounts/${id}`, body);

// --- vouchers ----------------------------------------------------------------

export const listVouchers = (
  params: QueryParams,
  signal?: AbortSignal,
): Promise<Paged<VoucherView>> =>
  apiList<VoucherView>('/books/vouchers', {
    method: 'GET',
    query: params,
    ...(signal ? { signal } : {}),
  });

export const getVoucher = (id: string): Promise<VoucherView> =>
  apiGet<VoucherView>(`/books/vouchers/${id}`);

export const createVoucher = (body: unknown): Promise<VoucherView> =>
  apiPost<VoucherView>('/books/vouchers', body);

export const updateVoucher = (id: string, body: unknown): Promise<VoucherView> =>
  apiPatch<VoucherView>(`/books/vouchers/${id}`, body);

export const deleteVoucher = (id: string): Promise<void> =>
  apiDelete<void>(`/books/vouchers/${id}`);

export const postVoucher = (id: string): Promise<VoucherView> =>
  apiPost<VoucherView>(`/books/vouchers/${id}/post`);

export const reverseVoucher = (
  id: string,
  body: { reason: string; date?: string },
): Promise<VoucherView> => apiPost<VoucherView>(`/books/vouchers/${id}/reverse`, body);

// --- reports -----------------------------------------------------------------

export const fetchDayBook = (
  params: QueryParams,
  signal?: AbortSignal,
): Promise<Paged<VoucherView>> =>
  apiList<VoucherView>('/books/day-book', {
    method: 'GET',
    query: params,
    ...(signal ? { signal } : {}),
  });

export interface LedgerResult {
  statement: LedgerView;
  total: number;
}

export const fetchLedger = async (
  params: QueryParams,
  signal?: AbortSignal,
): Promise<LedgerResult> => {
  const { data, meta } = await apiRequestFull<LedgerView>('/books/ledger', {
    method: 'GET',
    query: params,
    ...(signal ? { signal } : {}),
  });
  const total = typeof meta.total === 'number' ? meta.total : data.entries.length;
  return { statement: data, total };
};

export const fetchTrialBalance = (
  params: QueryParams,
  signal?: AbortSignal,
): Promise<TrialBalanceView> => apiGet<TrialBalanceView>('/books/trial-balance', params, signal);

export const exportTrialBalanceCsv = (params: QueryParams): Promise<void> =>
  downloadCsv('/books/trial-balance/export', csvFilename('trial-balance'), params);

// --- period locks ------------------------------------------------------------

export const listPeriodLocks = (clientId: string): Promise<PeriodLockView[]> =>
  apiGet<PeriodLockView[]>('/books/periods', { client: clientId });

export const lockPeriod = (
  period: string,
  body: { clientId: string; confirm: string; note?: string | null },
): Promise<PeriodLockView> =>
  apiPost<PeriodLockView>(`/books/periods/${encodeURIComponent(period)}/lock`, body);
