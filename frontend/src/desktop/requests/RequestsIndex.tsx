import { useQuery } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';

import { listDocumentRequests } from '@/api/documentRequests.api';
import { queryKeys } from '@/api/queryKeys';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { FilterBar } from '@/components/domain/FilterBar';
import { ListToolbar } from '@/components/domain/ListToolbar';
import { RequestList } from '@/components/domain/RequestList';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { REQUEST_STATUS_LABELS } from '@/lib/constants';
import { DOCUMENT_REQUEST_STATUSES } from '@/types/enums';

const FILTER_KEYS = ['status', 'overdue'] as const;

export function RequestsIndex() {
  usePageTitle('Requests');

  const params = useListParams({
    filterKeys: FILTER_KEYS,
    labels: { status: 'Status', overdue: 'Overdue' },
    valueLabels: { status: REQUEST_STATUS_LABELS, overdue: { true: 'Overdue only' } },
  });

  const query = useQuery({
    queryKey: queryKeys.documentRequests.list(params.query),
    queryFn: ({ signal }) => listDocumentRequests(params.query, signal),
    staleTime: 30_000,
  });

  const presets = [
    {
      id: 'overdue',
      label: '⚡ Overdue',
      active: params.filters.overdue === 'true',
      onClick: () => {
        params.setFilter('overdue', params.filters.overdue === 'true' ? null : 'true');
      },
    },
    {
      id: 'pending',
      label: '⏳ Pending Upload',
      active: params.filters.status === 'pending',
      onClick: () => {
        params.setFilter('status', params.filters.status === 'pending' ? null : 'pending');
      },
    },
    {
      id: 'received',
      label: '✅ Received',
      active: params.filters.status === 'received',
      onClick: () => {
        params.setFilter('status', params.filters.status === 'received' ? null : 'received');
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Requests"
        featureKey="requests"
        description="Everything the firm is waiting on from clients, across your scope."
      />

      <div data-tour="request-filter">
        <FilterBar
          showSearch
          search={params.search}
          onSearchChange={params.setSearch}
          searchPlaceholder="Search request descriptions..."
          presets={presets}
          values={params.filters}
          onFilterChange={params.setFilter}
          activeFilters={params.activeFilters}
          onClear={params.clearFilters}
          filters={[
            {
              key: 'status',
              label: 'Status',
              options: DOCUMENT_REQUEST_STATUSES.map((status) => ({
                value: status,
                label: REQUEST_STATUS_LABELS[status],
              })),
            },
            {
              key: 'overdue',
              label: 'Overdue',
              allLabel: 'All requests',
              options: [{ value: 'true', label: 'Overdue only' }],
            },
          ]}
        />
      </div>

      {query.isError ? (
        <ErrorState
          error={query.error}
          title="Requests did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <ListToolbar total={query.data?.total ?? null} noun="request" />

          <div data-tour="request-table">
            <RequestList
              showClient
              requests={query.data?.items ?? []}
            loading={query.isPending}
            emptySlot={
              params.hasFilters ? (
                <FilteredEmptyState
                  activeFilters={params.activeFilters.map(
                    (filter) => `${filter.label}: ${filter.value}`,
                  )}
                  onClear={params.clearFilters}
                />
              ) : (
                <EmptyState
                  icon={<Inbox size={20} aria-hidden="true" />}
                  title="Nothing is outstanding"
                  description="Raise requests from a client record or a filing, and they collect here until the client uploads."
                />
              )
            }
          />
          </div>

          {query.data === undefined || query.data.total === 0 ? null : (
            <Pagination
              page={query.data.page}
              limit={query.data.limit}
              total={query.data.total}
              totalPages={query.data.totalPages}
              onPageChange={params.setPage}
              onLimitChange={params.setLimit}
              label="requests"
            />
          )}
        </>
      )}
    </>
  );
}
