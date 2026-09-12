import { useQuery } from '@tanstack/react-query';
import { BookOpen, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';

import { fetchLedger } from '@/api/books.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Checkbox } from '@/components/ui/checkbox';
import { AccountPicker } from '@/desktop/books/components/AccountPicker';
import {
  BooksClientBar,
  BooksTabs,
  ChooseClientState,
  VoucherStatusPill,
  useBooksClient,
} from '@/desktop/books/components/BooksShell';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatDate } from '@/lib/date';

const FILTER_KEYS = ['client', 'account', 'from', 'to', 'includeDrafts'] as const;

export function Ledger() {
  usePageTitle('Ledger');
  const [clientId, setClientId] = useBooksClient();

  const params = useListParams({
    filterKeys: FILTER_KEYS,
    defaultLimit: 50,
    labels: { account: 'Account', from: 'From', to: 'To', includeDrafts: 'Drafts' },
    valueLabels: { includeDrafts: { true: 'included' } },
  });

  const hasAccount = (params.filters.account ?? '').length > 0;
  const query = useQuery({
    queryKey: queryKeys.books.ledger(params.query),
    queryFn: ({ signal }) => fetchLedger(params.query, signal),
    enabled: clientId !== null && hasAccount,
    staleTime: 15_000,
  });

  const statement = query.data?.statement;

  return (
    <>
      <PageHeader
        title="Ledger"
        description="One account's statement with a running balance. Opening balances carry forward into the window."
        actions={
          statement ? (
            <Button
              variant="secondary"
              iconLeft={<Printer size={14} aria-hidden="true" />}
              onClick={() => {
                window.print();
              }}
            >
              Print
            </Button>
          ) : null
        }
      />
      <BooksTabs clientId={clientId} />
      <BooksClientBar clientId={clientId} onClientChange={setClientId}>
        <div className="min-w-56 flex-1">
          <span
            aria-hidden="true"
            className="mb-1 block text-xs font-medium text-[var(--fd-text-secondary)]"
          >
            Account
          </span>
          {clientId === null ? null : (
            <AccountPicker
              clientId={clientId}
              ariaLabel="Account"
              value={params.filters.account ?? null}
              onChange={(value) => {
                params.setFilter('account', value);
              }}
            />
          )}
        </div>
        <div className="min-w-40">
          <span
            aria-hidden="true"
            className="mb-1 block text-xs font-medium text-[var(--fd-text-secondary)]"
          >
            From
          </span>
          <DatePicker
            ariaLabel="From date"
            value={params.filters.from ?? null}
            onChange={(value) => {
              params.setFilter('from', value);
            }}
          />
        </div>
        <div className="min-w-40">
          <span
            aria-hidden="true"
            className="mb-1 block text-xs font-medium text-[var(--fd-text-secondary)]"
          >
            To
          </span>
          <DatePicker
            ariaLabel="To date"
            value={params.filters.to ?? null}
            onChange={(value) => {
              params.setFilter('to', value);
            }}
          />
        </div>
        <div className="pb-1.5">
          <Checkbox
            label="Include drafts"
            checked={params.filters.includeDrafts === 'true'}
            onCheckedChange={(checked) => {
              params.setFilter('includeDrafts', checked ? 'true' : null);
            }}
          />
        </div>
      </BooksClientBar>

      {clientId === null ? (
        <ChooseClientState />
      ) : !hasAccount ? (
        <EmptyState
          icon={<BookOpen size={20} aria-hidden="true" />}
          title="Choose an account"
          description="Pick an account above to see its statement."
        />
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          title="This ledger did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : query.isPending ? (
        <Card>
          <div className="h-6 w-1/3 animate-pulse rounded bg-[var(--fd-surface-3)]" />
          <div className="mt-4 h-48 animate-pulse rounded bg-[var(--fd-surface-2)]" />
        </Card>
      ) : statement ? (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title={`${statement.account.code} · ${statement.account.name}`}
              description={
                statement.from === null && statement.to === null
                  ? 'All periods'
                  : `${statement.from ?? 'start'} to ${statement.to ?? 'today'}`
              }
            />
            <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs text-[var(--fd-text-tertiary)] uppercase">Opening</dt>
                <dd className="numeric font-medium">
                  {statement.opening.display} {statement.opening.side}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--fd-text-tertiary)] uppercase">Movements</dt>
                <dd className="numeric">
                  {statement.totals.debit.display} Dr · {statement.totals.credit.display} Cr
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--fd-text-tertiary)] uppercase">Closing</dt>
                <dd className="numeric font-semibold">
                  {statement.closing.display} {statement.closing.side}
                </dd>
              </div>
            </dl>
          </Card>

          <Card padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Ledger entries</caption>
                <thead>
                  <tr className="border-b border-[var(--fd-border-subtle)] text-left text-xs text-[var(--fd-text-secondary)]">
                    <th scope="col" className="px-4 py-2 font-medium">
                      Date
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Voucher
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Particulars
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">
                      Debit
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">
                      Credit
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[var(--fd-border-subtle)] text-[var(--fd-text-secondary)]">
                    <td colSpan={3} className="px-4 py-2 italic">
                      Opening balance
                    </td>
                    <td className="px-4 py-2" />
                    <td className="px-4 py-2" />
                    <td className="px-4 py-2 text-right numeric">
                      {statement.opening.display} {statement.opening.side}
                    </td>
                  </tr>
                  {statement.entries.map((entry) => (
                    <tr key={entry.voucherId} className="border-b border-[var(--fd-border-subtle)]">
                      <td className="px-4 py-2 numeric whitespace-nowrap">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          to={`/books/vouchers/${entry.voucherId}?client=${clientId}`}
                          className="numeric text-[var(--fd-accent)] hover:underline"
                        >
                          {entry.voucherNo ?? 'Draft'}
                        </Link>
                      </td>
                      <td className="px-4 py-2">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[var(--fd-text-secondary)]">
                            {entry.narration ?? entry.description ?? '—'}
                          </span>
                          <VoucherStatusPill status={entry.status} />
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right numeric">
                        {entry.debit.paise > 0 ? entry.debit.display : ''}
                      </td>
                      <td className="px-4 py-2 text-right numeric">
                        {entry.credit.paise > 0 ? entry.credit.display : ''}
                      </td>
                      <td className="px-4 py-2 text-right numeric font-medium">
                        {entry.balance.display} {entry.balance.side}
                      </td>
                    </tr>
                  ))}
                  {statement.entries.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-6 text-center text-[var(--fd-text-secondary)]"
                      >
                        No entries in this window.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          <Pagination
            page={params.page}
            limit={params.limit}
            total={query.data?.total ?? statement.entries.length}
            totalPages={
              query.data !== undefined ? Math.max(1, Math.ceil(query.data.total / params.limit)) : 1
            }
            onPageChange={params.setPage}
            onLimitChange={params.setLimit}
            label="entries"
          />
        </div>
      ) : null}
    </>
  );
}
