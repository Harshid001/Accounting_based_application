import { useQuery } from '@tanstack/react-query';
import { PieChart } from 'lucide-react';

import { exportReportCsv, fetchComplianceReport } from '@/api/reports.api';
import { queryKeys } from '@/api/queryKeys';
import { Card } from '@/components/ui/card';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/table';
import type { TableColumn } from '@/components/ui/table';
import { ComplianceStatusPill, OverdueBadge } from '@/components/domain/StatusPills';
import { PrintHeader } from '@/routes/reports/components/PrintHeader';
import { ReportFilters, ReportTabs } from '@/routes/reports/components/ReportFilters';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { CATEGORY_LABELS, COMPLIANCE_STATUS_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/date';
import { formatNumber } from '@/lib/format';
import { COMPLIANCE_STATUSES } from '@/types/enums';
import type { ComplianceReportRow } from '@/types/models';

const FILTER_KEYS = ['dateFrom', 'dateTo', 'client', 'category', 'status', 'complianceType'] as const;

const COLUMNS: Array<TableColumn<ComplianceReportRow>> = [
  { id: 'client', header: 'Client', cell: (row) => row.clientName },
  { id: 'filing', header: 'Filing', cell: (row) => row.complianceTypeName },
  {
    id: 'category',
    header: 'Category',
    hideBelow: 'lg',
    cell: (row) => CATEGORY_LABELS[row.category as keyof typeof CATEGORY_LABELS] ?? row.category,
  },
  { id: 'period', header: 'Period', cell: (row) => row.periodLabel },
  {
    id: 'due',
    header: 'Due',
    align: 'right',
    cell: (row) => (
      <span className="flex items-center justify-end gap-2">
        <span className="numeric">{formatDate(row.dueDate)}</span>
        <OverdueBadge overdue={row.isOverdue} />
      </span>
    ),
  },
  { id: 'status', header: 'Status', cell: (row) => <ComplianceStatusPill status={row.status} /> },
  {
    id: 'filed',
    header: 'Filed',
    align: 'right',
    hideBelow: 'lg',
    cell: (row) => <span className="numeric">{formatDate(row.filedDate, 'Not filed')}</span>,
  },
  {
    id: 'owner',
    header: 'Owner',
    hideBelow: 'lg',
    cell: (row) => row.assignedStaffName ?? 'Unassigned',
  },
];

export function ComplianceReport() {
  usePageTitle('Compliance status report');

  const params = useListParams({
    filterKeys: FILTER_KEYS,
    labels: {
      dateFrom: 'From',
      dateTo: 'To',
      client: 'Client',
      category: 'Category',
      status: 'Status',
      complianceType: 'Filing',
    },
    valueLabels: { category: CATEGORY_LABELS, status: COMPLIANCE_STATUS_LABELS },
  });

  const reportQuery = { ...params.filters };
  const query = useQuery({
    queryKey: queryKeys.reports.compliance(reportQuery),
    queryFn: () => fetchComplianceReport(reportQuery),
    staleTime: 60_000,
  });

  const rows = query.data?.rows ?? [];
  const totals = query.data?.totals ?? {};
  const filterSummary = params.activeFilters.map((filter) => `${filter.label}: ${filter.value}`);

  return (
    <>
      <PageHeader
        title="Compliance status"
        description="Filings by type, period and status, with overdue highlighted."
      />
      <ReportTabs />
      <ReportFilters
        params={params}
        exportDisabled={rows.length === 0}
        onExport={() => exportReportCsv('compliance', reportQuery)}
      />
      <PrintHeader title="Compliance status report" activeFilters={filterSummary} />

      {query.isError ? (
        <ErrorState
          error={query.error}
          title="This report did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <div className="space-y-4">
          <Card>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              <div>
                <dt className="text-2xs text-[var(--fd-text-tertiary)] uppercase">Overdue</dt>
                <dd className="numeric text-2xl font-semibold text-[var(--fd-status-danger)]">
                  {formatNumber(totals.overdue ?? 0)}
                </dd>
              </div>
              {COMPLIANCE_STATUSES.map((status) => (
                <div key={status}>
                  <dt className="text-2xs text-[var(--fd-text-tertiary)] uppercase">
                    {COMPLIANCE_STATUS_LABELS[status]}
                  </dt>
                  <dd className="numeric text-2xl font-semibold text-[var(--fd-text-primary)]">
                    {formatNumber(totals[status] ?? 0)}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <DataTable
            caption="Compliance status report"
            columns={COLUMNS}
            rows={rows}
            rowKey={(row) => row.id}
            state={query.isPending ? 'loading' : 'ready'}
            emptySlot={
              params.hasFilters ? (
                <FilteredEmptyState activeFilters={filterSummary} onClear={params.clearFilters} />
              ) : (
                <EmptyState
                  icon={<PieChart size={20} aria-hidden="true" />}
                  title="No filings to report on"
                  description="Once filings exist for the clients in your scope, this report fills in."
                />
              )
            }
          />
        </div>
      )}
    </>
  );
}
