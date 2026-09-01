import { useQuery } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import { Link } from 'react-router-dom';

import { listCompliance } from '@/api/compliance.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { ComplianceTable } from '@/routes/compliance/components/ComplianceTable';
import { FilterBar } from '@/components/domain/FilterBar';
import { ListToolbar } from '@/components/domain/ListToolbar';
import { useClientRecord } from '@/routes/clients/ClientRecord';
import { useListParams } from '@/hooks/useListParams';
import { useSession } from '@/context/SessionContext';
import { COMPLIANCE_STATUS_LABELS } from '@/lib/constants';
import { COMPLIANCE_STATUSES } from '@/types/enums';

const FILTER_KEYS = ['status', 'overdue'] as const;

export function ComplianceTab() {
  const { clientId, client } = useClientRecord();
  const { allows } = useSession();

  const params = useListParams({
    filterKeys: FILTER_KEYS,
    defaultSort: 'dueDate:desc',
    labels: { status: 'Status', overdue: 'Overdue' },
    valueLabels: {
      status: COMPLIANCE_STATUS_LABELS,
      overdue: { true: 'Overdue only', false: 'Not overdue' },
    },
  });

  const scoped = { ...params.query, client: clientId };
  const query = useQuery({
    queryKey: queryKeys.compliance.list(scoped),
    queryFn: ({ signal }) => listCompliance(scoped, signal),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-4">
      <FilterBar
        showSearch={false}
        search=""
        onSearchChange={() => undefined}
        values={params.filters}
        onFilterChange={params.setFilter}
        activeFilters={params.activeFilters}
        onClear={params.clearFilters}
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: COMPLIANCE_STATUSES.map((status) => ({
              value: status,
              label: COMPLIANCE_STATUS_LABELS[status],
            })),
          },
          {
            key: 'overdue',
            label: 'Overdue',
            allLabel: 'All filings',
            options: [{ value: 'true', label: 'Overdue only' }],
          },
        ]}
      />

      {query.isError ? (
        <ErrorState
          error={query.error}
          title="Filings did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <ListToolbar total={query.data?.total ?? null} noun="filing">
            {allows('compliance:bulk') ? (
              <Button asChild variant="secondary" size="sm">
                <Link to="/compliance/generate">Generate filings</Link>
              </Button>
            ) : null}
          </ListToolbar>

          <ComplianceTable
            items={query.data?.items ?? []}
            loading={query.isPending}
            showClient={false}
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
                  icon={<CalendarClock size={20} aria-hidden="true" />}
                  title="No filings for this client"
                  description={`Add a service on the Profile tab and FirmDesk will generate ${client.displayName}'s filings from it.`}
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
              label="filings"
            />
          )}
        </>
      )}
    </div>
  );
}
