import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Printer, Scale } from 'lucide-react';

import { exportTrialBalanceCsv, fetchTrialBalance } from '@/api/books.api';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { ExportButton } from '@/components/domain/ExportButton';
import { PrintHeader } from '@/desktop/reports/components/PrintHeader';
import { Checkbox } from '@/components/ui/checkbox';
import { useSession } from '@/context/SessionContext';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ACCOUNT_TYPE_LABELS } from '@/lib/constants';
import { formatPaise } from '@/lib/format';
import {
  BooksClientBar,
  BooksTabs,
  ChooseClientState,
  useBooksClient,
} from '@/desktop/books/components/BooksShell';
import type { TrialBalanceRowView, TrialBalanceView } from '@/types/models';

const FILTER_KEYS = ['client', 'asOf', 'includeDrafts'] as const;

function GroupTable({ group }: { group: TrialBalanceView['groups'][number] }) {
  if (group.rows.length === 0) return null;
  return (
    <Card padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{ACCOUNT_TYPE_LABELS[group.type]}</caption>
          <thead>
            <tr className="border-b border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] text-left text-xs text-[var(--fd-text-secondary)]">
              <th scope="col" className="px-4 py-2 font-medium">
                {ACCOUNT_TYPE_LABELS[group.type]}
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Sub-type
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                Debit
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                Credit
              </th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row: TrialBalanceRowView) => (
              <tr
                key={row.accountId}
                className="border-b border-[var(--fd-border-subtle)] last:border-b-0"
              >
                <td className="px-4 py-2">
                  <span className="mr-2 numeric text-xs text-[var(--fd-text-tertiary)]">
                    {row.code}
                  </span>
                  <span className={row.isSystem ? 'text-[var(--fd-text-secondary)]' : ''}>
                    {row.name}
                  </span>
                  {row.isSystem ? <Badge tone="muted">engine</Badge> : null}
                </td>
                <td className="px-4 py-2 text-xs text-[var(--fd-text-tertiary)]">
                  {row.subType === null ? '—' : row.subType}
                </td>
                <td className="px-4 py-2 text-right numeric">
                  {row.debit.paise > 0 ? row.debit.display : ''}
                </td>
                <td className="px-4 py-2 text-right numeric">
                  {row.credit.paise > 0 ? row.credit.display : ''}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--fd-border-strong,--fd-border-subtle)] font-medium">
              <td className="px-4 py-2" colSpan={2}>
                {ACCOUNT_TYPE_LABELS[group.type]} total
              </td>
              <td className="px-4 py-2 text-right numeric">{formatPaise(group.debit.paise)}</td>
              <td className="px-4 py-2 text-right numeric">{formatPaise(group.credit.paise)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

export function TrialBalance() {
  usePageTitle('Trial balance');
  const [clientId, setClientId] = useBooksClient();
  const { allows } = useSession();

  const params = useListParams({
    filterKeys: FILTER_KEYS,
    labels: { asOf: 'As of', includeDrafts: 'Drafts' },
    valueLabels: { includeDrafts: { true: 'included' } },
  });

  const query = useQuery({
    queryKey: queryKeys.books.trialBalance(params.query),
    queryFn: ({ signal }) => fetchTrialBalance(params.query, signal),
    enabled: clientId !== null,
    staleTime: 30_000,
  });

  const tb = query.data;

  return (
    <>
      <PageHeader
        title="Trial balance"
        description="Every account's closing balance for the period. The books are healthy when debits equal credits."
        actions={
          tb && allows('books:export') ? (
            <ExportButton
              onExport={() => exportTrialBalanceCsv(params.query)}
              disabled={tb.groups.every((group) => group.rows.length === 0)}
              disabledReason="There is nothing in this view to export."
            />
          ) : null
        }
      />
      <BooksTabs clientId={clientId} />
      <BooksClientBar clientId={clientId} onClientChange={setClientId}>
        <div className="min-w-40">
          <span
            aria-hidden="true"
            className="mb-1 block text-xs font-medium text-[var(--fd-text-secondary)]"
          >
            As of
          </span>
          <DatePicker
            ariaLabel="As of date"
            value={params.filters.asOf ?? null}
            onChange={(value) => {
              params.setFilter('asOf', value);
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
        <Button
          variant="secondary"
          size="sm"
          iconLeft={<Printer size={14} aria-hidden="true" />}
          data-print="hide"
          onClick={() => {
            window.print();
          }}
        >
          Print
        </Button>
      </BooksClientBar>

      <PrintHeader
        title="Trial balance"
        activeFilters={params.activeFilters
          .filter((filter) => filter.key !== 'client')
          .map((filter) => `${filter.label}: ${filter.value}`)}
      />

      {clientId === null ? (
        <ChooseClientState />
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          title="The trial balance did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : query.isPending ? (
        <Card>
          <div className="h-6 w-1/3 animate-pulse rounded bg-[var(--fd-surface-3)]" />
          <div className="mt-4 h-48 animate-pulse rounded bg-[var(--fd-surface-2)]" />
        </Card>
      ) : tb ? (
        <div className="space-y-4">
          <Card data-print="hide">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                {tb.balanced ? (
                  <>
                    <CheckCircle2
                      size={16}
                      aria-hidden="true"
                      className="text-[var(--fd-status-success)]"
                    />
                    <span>Debits equal credits — the books balance.</span>
                  </>
                ) : (
                  <>
                    <Scale
                      size={16}
                      aria-hidden="true"
                      className="text-[var(--fd-status-danger)]"
                    />
                    <span className="text-[var(--fd-status-danger)]">
                      Out of balance — investigate before trusting these numbers.
                    </span>
                  </>
                )}
              </div>
              <dl className="flex gap-6 text-sm">
                <div>
                  <dt className="text-xs text-[var(--fd-text-tertiary)] uppercase">Total debits</dt>
                  <dd className="numeric font-semibold">{tb.totals.debit.display}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--fd-text-tertiary)] uppercase">
                    Total credits
                  </dt>
                  <dd className="numeric font-semibold">{tb.totals.credit.display}</dd>
                </div>
              </dl>
            </div>
          </Card>

          {tb.groups.every((group) => group.rows.length === 0) ? (
            <EmptyState
              icon={<Scale size={20} aria-hidden="true" />}
              title="Nothing in the books yet"
              description="Post vouchers and the trial balance fills in."
            />
          ) : (
            tb.groups.map((group) => <GroupTable key={group.type} group={group} />)
          )}
        </div>
      ) : null}
    </>
  );
}
