import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';

import { fetchDayBook } from '@/api/books.api';
import { queryKeys } from '@/api/queryKeys';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { ListToolbar } from '@/components/domain/ListToolbar';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  BooksClientBar,
  BooksTabs,
  ChooseClientState,
  useBooksClient,
} from '@/routes/books/components/BooksShell';
import { VoucherTable } from '@/routes/books/components/VoucherTable';

const FILTER_KEYS = ['client', 'from', 'to', 'includeDrafts'] as const;

export function DayBook() {
  usePageTitle('Day book');
  const [clientId, setClientId] = useBooksClient();

  const params = useListParams({
    filterKeys: FILTER_KEYS,
    defaultLimit: 50,
    labels: { from: 'From', to: 'To', includeDrafts: 'Drafts' },
    valueLabels: { includeDrafts: { true: 'included' } },
  });

  const query = useQuery({
    queryKey: queryKeys.books.dayBook(params.query),
    queryFn: ({ signal }) => fetchDayBook(params.query, signal),
    enabled: clientId !== null,
    staleTime: 15_000,
  });

  const filterSummary = params.activeFilters
    .filter((filter) => filter.key !== 'client')
    .map((filter) => `${filter.label}: ${filter.value}`);

  return (
    <>
      <PageHeader
        title="Day book"
        description="Every posted voucher in date order. Turn on drafts to preview their effect."
      />
      <BooksTabs clientId={clientId} />
      <BooksClientBar clientId={clientId} onClientChange={setClientId}>
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
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          title="The day book did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <ListToolbar total={query.data?.total ?? null} noun="voucher" />
          <VoucherTable
            caption="Day book"
            clientId={clientId}
            items={query.data?.items ?? []}
            loading={query.isPending}
            emptySlot={
              filterSummary.length > 0 ? (
                <FilteredEmptyState activeFilters={filterSummary} onClear={params.clearFilters} />
              ) : (
                <EmptyState
                  icon={<CalendarDays size={20} aria-hidden="true" />}
                  title="Nothing posted yet"
                  description="Posted vouchers appear here in date order."
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
  );
}
