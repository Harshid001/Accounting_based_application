import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { exportComplianceCsv, listCompliance } from '@/api/compliance.api';
import { listComplianceTypes } from '@/api/complianceTypes.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { ExportButton } from '@/components/domain/ExportButton';
import { FilterBar } from '@/components/domain/FilterBar';
import { ListToolbar } from '@/components/domain/ListToolbar';
import { ComplianceTable } from '@/routes/compliance/components/ComplianceTable';
import { useSession } from '@/context/SessionContext';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { CATEGORY_LABELS, COMPLIANCE_STATUS_LABELS } from '@/lib/constants';
import { COMPLIANCE_CATEGORIES, COMPLIANCE_STATUSES } from '@/types/enums';

const FILTER_KEYS = ['status', 'category', 'complianceType', 'overdue', 'dueFrom', 'dueTo'] as const;

export function ComplianceList() {
  usePageTitle('Filings');
  const { allows } = useSession();

  const catalogue = useQuery({
    queryKey: queryKeys.complianceTypes.list(),
    queryFn: () => listComplianceTypes(),
    staleTime: 5 * 60_000,
  });

  const typeLabels = Object.fromEntries(
    (catalogue.data ?? []).map((type) => [type.id, type.name]),
  );

  const params = useListParams({
    filterKeys: FILTER_KEYS,
    defaultSort: 'dueDate:asc',
    labels: {
      status: 'Status',
      category: 'Category',
      complianceType: 'Filing',
      overdue: 'Overdue',
      dueFrom: 'Due from',
      dueTo: 'Due to',
    },
    valueLabels: {
      status: COMPLIANCE_STATUS_LABELS,
      category: CATEGORY_LABELS,
      complianceType: typeLabels,
      overdue: { true: 'Overdue only' },
    },
  });

  const query = useQuery({
    queryKey: queryKeys.compliance.list(params.query),
    queryFn: ({ signal }) => listCompliance(params.query, signal),
    staleTime: 30_000,
  });

  return (
    <>
      <PageHeader
        title="Filings"
        description="Every statutory filing FirmDesk is tracking, with the period it covers."
        actions={
          <>
            {allows('compliance:export') ? (
              <ExportButton
                onExport={() => exportComplianceCsv(params.query)}
                disabled={(query.data?.total ?? 0) === 0}
                disabledReason="There is nothing in this view to export."
              />
            ) : null}
            {allows('compliance:bulk') ? (
              <Button asChild variant="primary" size="sm">
                <Link to="/compliance/generate">
                  <Sparkles size={14} aria-hidden="true" />
                  Generate filings
                </Link>
              </Button>
            ) : null}
          </>
        }
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
          {
            key: 'category',
            label: 'Category',
            options: COMPLIANCE_CATEGORIES.map((category) => ({
              value: category,
              label: CATEGORY_LABELS[category],
            })),
          },
          {
            key: 'complianceType',
            label: 'Filing',
            options: (catalogue.data ?? []).map((type) => ({
              value: type.id,
              label: type.name,
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
          title="The filing list did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <ListToolbar total={query.data?.total ?? null} noun="filing" />

          <ComplianceTable
            items={query.data?.items ?? []}
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
                  icon={<CalendarClock size={20} aria-hidden="true" />}
                  title="No filings yet"
                  description="Filings are generated from client services. Add services to a client, or generate a period in bulk."
                  action={
                    allows('compliance:bulk') ? (
                      <Button asChild variant="primary" size="sm">
                        <Link to="/compliance/generate">Generate filings</Link>
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
              label="filings"
            />
          )}
        </>
      )}
    </>
  );
}
