import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { exportReportCsv, fetchRosterReport } from '@/api/reports.api';
import { queryKeys } from '@/api/queryKeys';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/table';
import type { TableColumn } from '@/components/ui/table';
import { ClientStatusPill } from '@/components/domain/StatusPills';
import { PrintHeader } from '@/routes/reports/components/PrintHeader';
import { ReportFilters, ReportTabs } from '@/routes/reports/components/ReportFilters';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { CLIENT_TYPE_LABELS } from '@/lib/constants';
import { formatDate, isPastDateOnly } from '@/lib/date';
import { joinNames } from '@/lib/format';
import type { RosterRow } from '@/types/models';

const FILTER_KEYS = ['dateFrom', 'dateTo', 'client'] as const;

const COLUMNS: Array<TableColumn<RosterRow>> = [
  {
    id: 'client',
    header: 'Client',
    cell: (row) => (
      <Link
        to={`/clients/${row.clientId}/profile`}
        className="rounded-sm font-medium text-[var(--fd-text-primary)] hover:underline"
      >
        {row.displayName}
      </Link>
    ),
  },
  {
    id: 'type',
    header: 'Type',
    hideBelow: 'lg',
    cell: (row) => CLIENT_TYPE_LABELS[row.clientType],
  },
  { id: 'status', header: 'Status', cell: (row) => <ClientStatusPill status={row.status} /> },
  {
    id: 'services',
    header: 'Services',
    cell: (row) =>
      row.services.length === 0 ? (
        <span className="text-[var(--fd-text-tertiary)]">None</span>
      ) : (
        joinNames(row.services, 3)
      ),
  },
  {
    id: 'staff',
    header: 'Assigned',
    hideBelow: 'lg',
    cell: (row) => joinNames(row.assignedStaff, 2),
  },
  {
    id: 'due',
    header: 'Next deadline',
    align: 'right',
    cell: (row) => (
      <span
        className={
          isPastDateOnly(row.nextDueDate) ? 'numeric text-[var(--fd-status-danger)]' : 'numeric'
        }
      >
        {formatDate(row.nextDueDate, 'None')}
      </span>
    ),
  },
  {
    id: 'requests',
    header: 'Open asks',
    align: 'right',
    hideBelow: 'md',
    cell: (row) => <span className="numeric">{row.openRequests}</span>,
  },
];

export function RosterReport() {
  usePageTitle('Client roster report');

  const params = useListParams({
    filterKeys: FILTER_KEYS,
    labels: { dateFrom: 'From', dateTo: 'To', client: 'Client' },
  });

  const reportQuery = { ...params.filters };
  const query = useQuery({
    queryKey: queryKeys.reports.roster(reportQuery),
    queryFn: () => fetchRosterReport(reportQuery),
    staleTime: 60_000,
  });

  const rows = query.data ?? [];
  const filterSummary = params.activeFilters.map((filter) => `${filter.label}: ${filter.value}`);

  return (
    <>
      <PageHeader
        title="Client roster"
        description="Every client with its status, services, assigned staff and next deadline."
      />
      <ReportTabs />
      <ReportFilters
        params={params}
        showComplianceFilters={false}
        exportDisabled={rows.length === 0}
        onExport={() => exportReportCsv('roster', reportQuery)}
      />
      <PrintHeader title="Client roster report" activeFilters={filterSummary} />

      {query.isError ? (
        <ErrorState
          error={query.error}
          title="This report did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <DataTable
          caption="Client roster report"
          columns={COLUMNS}
          rows={rows}
          rowKey={(row) => row.clientId}
          state={query.isPending ? 'loading' : 'ready'}
          emptySlot={
            params.hasFilters ? (
              <FilteredEmptyState activeFilters={filterSummary} onClear={params.clearFilters} />
            ) : (
              <EmptyState
                icon={<Building2 size={20} aria-hidden="true" />}
                title="No clients to report on"
                description="Add clients and this roster fills in automatically."
              />
            )
          }
        />
      )}
    </>
  );
}
