import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';

import { exportReportCsv, fetchWorkloadReport } from '@/api/reports.api';
import { queryKeys } from '@/api/queryKeys';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/table';
import type { TableColumn } from '@/components/ui/table';
import { PrintHeader } from '@/routes/reports/components/PrintHeader';
import { ReportFilters, ReportTabs } from '@/routes/reports/components/ReportFilters';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatMinutes, formatNumber } from '@/lib/format';
import type { WorkloadRow } from '@/types/models';

const FILTER_KEYS = ['dateFrom', 'dateTo', 'client'] as const;

const numeric = (value: number) => <span className="numeric">{formatNumber(value)}</span>;

const COLUMNS: Array<TableColumn<WorkloadRow>> = [
  { id: 'staff', header: 'Staff member', cell: (row) => row.staffName },
  { id: 'openTasks', header: 'Open tasks', align: 'right', cell: (row) => numeric(row.openTasks) },
  {
    id: 'overdueTasks',
    header: 'Overdue tasks',
    align: 'right',
    cell: (row) => (
      <span
        className={
          row.overdueTasks > 0 ? 'numeric text-[var(--fd-status-danger)]' : 'numeric'
        }
      >
        {formatNumber(row.overdueTasks)}
      </span>
    ),
  },
  {
    id: 'completedTasks',
    header: 'Completed',
    align: 'right',
    hideBelow: 'lg',
    cell: (row) => numeric(row.completedTasks),
  },
  {
    id: 'openFilings',
    header: 'Open filings',
    align: 'right',
    cell: (row) => numeric(row.openFilings),
  },
  {
    id: 'overdueFilings',
    header: 'Overdue filings',
    align: 'right',
    cell: (row) => (
      <span
        className={
          row.overdueFilings > 0 ? 'numeric text-[var(--fd-status-danger)]' : 'numeric'
        }
      >
        {formatNumber(row.overdueFilings)}
      </span>
    ),
  },
  {
    id: 'estimate',
    header: 'Estimated',
    align: 'right',
    hideBelow: 'lg',
    cell: (row) => <span className="numeric">{formatMinutes(row.estimateMinutes)}</span>,
  },
  {
    id: 'logged',
    header: 'Logged',
    align: 'right',
    hideBelow: 'lg',
    cell: (row) => <span className="numeric">{formatMinutes(row.loggedMinutes)}</span>,
  },
];

export function WorkloadReport() {
  usePageTitle('Workload report');

  const params = useListParams({
    filterKeys: FILTER_KEYS,
    labels: { dateFrom: 'From', dateTo: 'To', client: 'Client' },
  });

  const reportQuery = { ...params.filters };
  const query = useQuery({
    queryKey: queryKeys.reports.workload(reportQuery),
    queryFn: () => fetchWorkloadReport(reportQuery),
    staleTime: 60_000,
  });

  const rows = query.data ?? [];
  const filterSummary = params.activeFilters.map((filter) => `${filter.label}: ${filter.value}`);

  return (
    <>
      <PageHeader
        title="Workload"
        description="Open, overdue and completed work per person, with estimate against logged time."
      />
      <ReportTabs />
      <ReportFilters
        params={params}
        showComplianceFilters={false}
        exportDisabled={rows.length === 0}
        onExport={() => exportReportCsv('workload', reportQuery)}
      />
      <PrintHeader title="Workload report" activeFilters={filterSummary} />

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
          caption="Workload report"
          columns={COLUMNS}
          rows={rows}
          rowKey={(row) => row.staffId}
          state={query.isPending ? 'loading' : 'ready'}
          emptySlot={
            params.hasFilters ? (
              <FilteredEmptyState activeFilters={filterSummary} onClear={params.clearFilters} />
            ) : (
              <EmptyState
                icon={<Users size={20} aria-hidden="true" />}
                title="Nobody to report on"
                description="Once work is assigned to staff members, their load shows up here."
              />
            )
          }
        />
      )}
    </>
  );
}
