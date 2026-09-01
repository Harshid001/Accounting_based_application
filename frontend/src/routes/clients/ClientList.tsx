import { useQuery } from '@tanstack/react-query';
import { Building2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { exportClientsCsv, listClients } from '@/api/clients.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { ExportButton } from '@/components/domain/ExportButton';
import { FilterBar } from '@/components/domain/FilterBar';
import { ListToolbar } from '@/components/domain/ListToolbar';
import { ClientTable } from '@/routes/clients/components/ClientTable';
import { useSession } from '@/context/SessionContext';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { CLIENT_STATUS_LABELS, CLIENT_TYPE_LABELS } from '@/lib/constants';
import { CLIENT_STATUSES, CLIENT_TYPES } from '@/types/enums';

const FILTER_KEYS = ['status', 'clientType', 'archived', 'pinned'] as const;

export function ClientList() {
  usePageTitle('Clients');
  const { allows } = useSession();

  const params = useListParams({
    filterKeys: FILTER_KEYS,
    defaultSort: 'displayName:asc',
    labels: {
      status: 'Status',
      clientType: 'Type',
      archived: 'Archived',
      pinned: 'Pinned',
    },
    valueLabels: {
      status: CLIENT_STATUS_LABELS,
      clientType: CLIENT_TYPE_LABELS,
      archived: { true: 'Archived only', false: 'Active only' },
      pinned: { true: 'Pinned only' },
    },
  });

  const query = useQuery({
    queryKey: queryKeys.clients.list(params.query),
    queryFn: ({ signal }) => listClients(params.query, signal),
    staleTime: 30_000,
  });

  const rows = query.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Clients"
        description={
          allows('client:create')
            ? 'Every client record the firm holds.'
            : 'The clients you are assigned to.'
        }
        actions={
          <>
            {allows('client:export') ? (
              <ExportButton
                onExport={() => exportClientsCsv(params.query)}
                disabled={rows.length === 0}
                disabledReason="There is nothing in this view to export."
              />
            ) : null}
            {allows('client:create') ? (
              <Button asChild variant="primary" size="sm">
                <Link to="/clients/new">
                  <Plus size={14} aria-hidden="true" />
                  Add client
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <FilterBar
        search={params.search}
        onSearchChange={params.setSearch}
        searchPlaceholder="Search by name, PAN or GSTIN"
        values={params.filters}
        onFilterChange={params.setFilter}
        activeFilters={params.activeFilters}
        onClear={params.clearFilters}
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: CLIENT_STATUSES.map((status) => ({
              value: status,
              label: CLIENT_STATUS_LABELS[status],
            })),
          },
          {
            key: 'clientType',
            label: 'Type',
            options: CLIENT_TYPES.map((type) => ({
              value: type,
              label: CLIENT_TYPE_LABELS[type],
            })),
          },
          {
            key: 'archived',
            label: 'Archived',
            allLabel: 'Active only',
            options: [{ value: 'true', label: 'Archived only' }],
          },
          {
            key: 'pinned',
            label: 'Pinned',
            allLabel: 'All clients',
            options: [{ value: 'true', label: 'Pinned only' }],
          },
        ]}
      />

      {query.isError ? (
        <ErrorState
          error={query.error}
          title="The client list did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <ListToolbar total={query.data?.total ?? null} noun="client" />

          <ClientTable
            clients={rows}
            loading={query.isPending}
            sort={
              params.sortField === null
                ? null
                : { field: params.sortField, direction: params.sortDirection }
            }
            onSortChange={params.toggleSort}
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
                  icon={<Building2 size={20} aria-hidden="true" />}
                  title="No clients yet"
                  description={
                    allows('client:create')
                      ? 'Add the first client record and the rest of FirmDesk starts filling in.'
                      : 'Nothing has been assigned to you yet. An administrator can assign clients from the client record.'
                  }
                  action={
                    allows('client:create') ? (
                      <Button asChild variant="primary" size="sm">
                        <Link to="/clients/new">Add client</Link>
                      </Button>
                    ) : undefined
                  }
                />
              )
            }
          />

          {query.data === undefined || query.data.total === 0 ? null : (
            <Pagination
              page={query.data.page}
              limit={query.data.limit}
              total={query.data.total}
              totalPages={query.data.totalPages}
              onPageChange={params.setPage}
              onLimitChange={params.setLimit}
              label="clients"
            />
          )}
        </>
      )}
    </>
  );
}
