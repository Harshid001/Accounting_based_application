import { useQuery } from '@tanstack/react-query';
import { CalendarCheck2 } from 'lucide-react';

import { listPortalCompliance } from '@/api/portal.api';
import { queryKeys } from '@/api/queryKeys';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { DataTable } from '@/components/ui/table';
import type { TableColumn } from '@/components/ui/table';
import { ComplianceStatusPill, OverdueBadge } from '@/components/domain/StatusPills';
import { FilterBar } from '@/components/domain/FilterBar';
import { useActiveClient } from '@/context/ActiveClientContext';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { COMPLIANCE_STATUS_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/date';
import { COMPLIANCE_STATUSES } from '@/types/enums';
import type { PortalComplianceRow } from '@/types/models';

const COLUMNS: Array<TableColumn<PortalComplianceRow>> = [
  {
    id: 'filing',
    header: 'Filing',
    cell: (row) => (
      <span className="min-w-0">
        <span className="block truncate font-medium text-[var(--fd-text-primary)]">
          {row.complianceTypeName}
        </span>
        <span className="text-2xs block text-[var(--fd-text-tertiary)]">{row.periodLabel}</span>
      </span>
    ),
  },
  {
    id: 'due',
    header: 'Due',
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-2">
        <span className="numeric">{formatDate(row.dueDate)}</span>
        <OverdueBadge overdue={row.isOverdue} />
      </span>
    ),
  },
  { id: 'status', header: 'Status', cell: (row) => <ComplianceStatusPill status={row.status} /> },
  {
    id: 'filed',
    header: 'Filed on',
    align: 'right',
    cell: (row) => <span className="numeric">{formatDate(row.filedDate, 'Not filed yet')}</span>,
  },
];

export function PortalCompliance() {
  usePageTitle('Your filings');
  const { activeClientId } = useActiveClient();
  const clientId = activeClientId ?? '';

  const params = useListParams({
    filterKeys: ['status'],
    labels: { status: 'Status' },
    valueLabels: { status: COMPLIANCE_STATUS_LABELS },
  });

  const query = useQuery({
    queryKey: queryKeys.portal.compliance(clientId, params.query),
    queryFn: () => listPortalCompliance(params.query),
    enabled: clientId.length > 0,
    staleTime: 30_000,
  });

  return (
    <>
      <PageHeader
        title="Your filings"
        description="Everything your firm files for you, and where each one stands. This view is read-only."
      />

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
        ]}
      />

      {query.isError ? (
        <ErrorState
          error={query.error}
          title="Your filings did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <DataTable
            density="comfortable"
            caption="Your filings"
            columns={COLUMNS}
            rows={query.data?.items ?? []}
            rowKey={(row) => row.id}
            state={query.isPending ? 'loading' : 'ready'}
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
                  icon={<CalendarCheck2 size={20} aria-hidden="true" />}
                  title="No filings yet"
                  description="Once your firm sets up the services it handles for you, they appear here with their deadlines."
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
    </>
  );
}
