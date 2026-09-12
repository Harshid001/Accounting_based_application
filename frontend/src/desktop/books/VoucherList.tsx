import { useQuery } from '@tanstack/react-query';
import { Plus, ReceiptText } from 'lucide-react';
import { Link } from 'react-router-dom';

import { listVouchers } from '@/api/books.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { FilterBar } from '@/components/domain/FilterBar';
import { ListToolbar } from '@/components/domain/ListToolbar';
import { useSession } from '@/context/SessionContext';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { VOUCHER_STATUS_LABELS, VOUCHER_TYPE_LABELS } from '@/lib/constants';
import {
  BooksClientBar,
  BooksTabs,
  ChooseClientState,
  useBooksClient,
} from '@/desktop/books/components/BooksShell';
import { VoucherTable } from '@/desktop/books/components/VoucherTable';
import { VOUCHER_STATUSES, VOUCHER_TYPES } from '@/types/enums';

const FILTER_KEYS = ['client', 'status', 'type', 'from', 'to', 'account'] as const;

export function VoucherList() {
  usePageTitle('Vouchers');
  const [clientId, setClientId] = useBooksClient();
  const { allows } = useSession();

  const params = useListParams({
    filterKeys: FILTER_KEYS,
    defaultSort: 'date:desc',
    labels: { status: 'Status', type: 'Type', from: 'From', to: 'To', account: 'Account' },
    valueLabels: { status: VOUCHER_STATUS_LABELS, type: VOUCHER_TYPE_LABELS },
  });

  const query = useQuery({
    queryKey: queryKeys.books.vouchers.list(params.query),
    queryFn: ({ signal }) => listVouchers(params.query, signal),
    enabled: clientId !== null,
    staleTime: 15_000,
  });

  const suffix = clientId === null ? '' : `?client=${clientId}`;
  const filterSummary = params.activeFilters
    .filter((filter) => filter.key !== 'client')
    .map((filter) => `${filter.label}: ${filter.value}`);

  return (
    <>
      <PageHeader
        title="Vouchers"
        description="Drafts are editable. Posted vouchers are permanent and corrected only by reversal."
        actions={
          clientId !== null && allows('books:write') ? (
            <Button asChild variant="primary" iconLeft={<Plus size={16} aria-hidden="true" />}>
              <Link to={`/books/vouchers/new${suffix}`}>New voucher</Link>
            </Button>
          ) : null
        }
      />
      <BooksTabs clientId={clientId} />
      <BooksClientBar clientId={clientId} onClientChange={setClientId} />

      {clientId === null ? (
        <ChooseClientState />
      ) : (
        <>
          <FilterBar
            showSearch
            search={params.search}
            onSearchChange={params.setSearch}
            searchPlaceholder="Voucher no, narration or reference"
            values={params.filters}
            onFilterChange={params.setFilter}
            activeFilters={params.activeFilters.filter((filter) => filter.key !== 'client')}
            onClear={() => {
              params.setFilters({ status: null, type: null, from: null, to: null, account: null });
              params.setSearch('');
            }}
            presets={[
              {
                id: 'drafts',
                label: 'Drafts',
                active: params.filters.status === 'draft',
                onClick: () => {
                  params.setFilter('status', params.filters.status === 'draft' ? null : 'draft');
                },
              },
              {
                id: 'posted',
                label: 'Posted',
                active: params.filters.status === 'posted',
                onClick: () => {
                  params.setFilter('status', params.filters.status === 'posted' ? null : 'posted');
                },
              },
            ]}
            filters={[
              {
                key: 'status',
                label: 'Status',
                allLabel: 'All statuses',
                options: VOUCHER_STATUSES.map((status) => ({
                  value: status,
                  label: VOUCHER_STATUS_LABELS[status],
                })),
              },
              {
                key: 'type',
                label: 'Type',
                allLabel: 'All types',
                options: VOUCHER_TYPES.map((type) => ({
                  value: type,
                  label: VOUCHER_TYPE_LABELS[type],
                })),
              },
            ]}
            extra={
              <>
                <div className="min-w-40">
                  <DatePicker
                    ariaLabel="From date"
                    value={params.filters.from ?? null}
                    onChange={(value) => {
                      params.setFilter('from', value);
                    }}
                  />
                </div>
                <div className="min-w-40">
                  <DatePicker
                    ariaLabel="To date"
                    value={params.filters.to ?? null}
                    onChange={(value) => {
                      params.setFilter('to', value);
                    }}
                  />
                </div>
              </>
            }
          />

          {query.isError ? (
            <ErrorState
              error={query.error}
              title="Vouchers did not load"
              onRetry={() => {
                void query.refetch();
              }}
            />
          ) : (
            <>
              <ListToolbar total={query.data?.total ?? null} noun="voucher" />
              <VoucherTable
                clientId={clientId}
                items={query.data?.items ?? []}
                loading={query.isPending}
                sort={
                  params.sortField === null
                    ? null
                    : { field: params.sortField, direction: params.sortDirection }
                }
                onSortChange={params.toggleSort}
                emptySlot={
                  filterSummary.length > 0 || params.search.length > 0 ? (
                    <FilteredEmptyState
                      activeFilters={filterSummary}
                      onClear={params.clearFilters}
                    />
                  ) : (
                    <EmptyState
                      icon={<ReceiptText size={20} aria-hidden="true" />}
                      title="No vouchers yet"
                      description="Record the first sale, purchase or payment for this client."
                      action={
                        allows('books:write') ? (
                          <Button asChild variant="primary">
                            <Link to={`/books/vouchers/new${suffix}`}>New voucher</Link>
                          </Button>
                        ) : undefined
                      }
                    />
                  )
                }
              />
              {(query.data?.total ?? 0) > 0 ? (
                <Pagination
                  page={params.page}
                  limit={params.limit}
                  total={query.data?.total ?? 0}
                  totalPages={query.data?.totalPages ?? 1}
                  onPageChange={params.setPage}
                  onLimitChange={params.setLimit}
                  label="vouchers"
                />
              ) : null}
            </>
          )}
        </>
      )}
    </>
  );
}
