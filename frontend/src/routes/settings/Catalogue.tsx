import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { deleteComplianceType, listComplianceTypes } from '@/api/complianceTypes.api';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { IconButton } from '@/components/ui/icon-button';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/table';
import type { TableColumn } from '@/components/ui/table';
import { FilterBar } from '@/components/domain/FilterBar';
import { ListToolbar } from '@/components/domain/ListToolbar';
import { SettingsNav } from '@/routes/settings/components/SettingsNav';
import { describeRule } from '@/routes/settings/components/DueDateRuleEditor';
import { useConfirm } from '@/hooks/useConfirm';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/context/ToastContext';
import { CATEGORY_LABELS, FREQUENCY_LABELS, SEEDED_DUE_DATE_HINT } from '@/lib/constants';
import { COMPLIANCE_CATEGORIES } from '@/types/enums';
import type { ComplianceTypeView } from '@/types/models';

const FILTER_KEYS = ['category', 'active'] as const;

export function Catalogue() {
  usePageTitle('Compliance catalogue');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, errorToast } = useToast();
  const confirm = useConfirm();

  const params = useListParams({
    filterKeys: FILTER_KEYS,
    labels: { category: 'Category', active: 'Active' },
    valueLabels: {
      category: CATEGORY_LABELS,
      active: { true: 'Active only', false: 'Inactive only' },
    },
  });

  const query = useQuery({
    queryKey: queryKeys.complianceTypes.list(params.filters),
    queryFn: () => listComplianceTypes(params.filters),
    staleTime: 60_000,
  });

  const remove = useMutation({
    mutationFn: deleteComplianceType,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.complianceTypes.all });
      success('Catalogue entry deleted');
    },
    onError: (error: unknown) => {
      errorToast(error, 'That entry was not deleted');
    },
  });

  const rows = (query.data ?? []).filter((type) =>
    params.search.trim().length === 0
      ? true
      : type.name.toLowerCase().includes(params.search.trim().toLowerCase()),
  );

  const columns: Array<TableColumn<ComplianceTypeView>> = [
    {
      id: 'name',
      header: 'Filing',
      cell: (row) => (
        <span className="min-w-0">
          <Link
            to={`/settings/catalogue/${row.id}`}
            className="block truncate rounded-sm font-medium text-[var(--fd-text-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]"
          >
            {row.name}
          </Link>
          <span className="text-2xs numeric block text-[var(--fd-text-tertiary)]">{row.code}</span>
        </span>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      cell: (row) => <Badge tone="neutral">{CATEGORY_LABELS[row.category]}</Badge>,
    },
    {
      id: 'frequency',
      header: 'Frequency',
      hideBelow: 'md',
      cell: (row) => (
        <span className="text-[var(--fd-text-secondary)]">
          {row.isRecurring ? FREQUENCY_LABELS[row.defaultFrequency] : 'One off'}
        </span>
      ),
    },
    {
      id: 'rule',
      header: 'Due-date rule',
      hideBelow: 'lg',
      cell: (row) => (
        <span className="text-[var(--fd-text-secondary)]">{describeRule(row.dueDateRule)}</span>
      ),
    },
    {
      id: 'checklist',
      header: 'Checklist',
      align: 'right',
      hideBelow: 'lg',
      cell: (row) => (
        <span className="numeric text-[var(--fd-text-secondary)]">
          {row.defaultDocumentChecklist.length}
        </span>
      ),
    },
    {
      id: 'state',
      header: 'State',
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1.5">
          {row.active ? <Badge tone="done">Active</Badge> : <Badge tone="muted">Inactive</Badge>}
          {row.isSeeded ? <Badge tone="neutral">Seeded</Badge> : null}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Compliance catalogue"
        description="One list backs the services the firm offers and the filings it tracks."
        actions={
          <Button asChild variant="primary" size="sm">
            <Link to="/settings/catalogue/new">
              <Plus size={14} aria-hidden="true" />
              Add entry
            </Link>
          </Button>
        }
      />
      <SettingsNav />

      <div
        role="note"
        className="mb-4 rounded-md border border-[var(--fd-status-waiting)] bg-[var(--fd-status-waiting-bg)] px-3 py-2 text-xs text-[var(--fd-text-primary)]"
      >
        {SEEDED_DUE_DATE_HINT} FirmDesk does not assert statutory dates; the firm owns their
        correctness.
      </div>

      <FilterBar
        search={params.search}
        onSearchChange={params.setSearch}
        searchPlaceholder="Search catalogue entries"
        values={params.filters}
        onFilterChange={params.setFilter}
        activeFilters={params.activeFilters}
        onClear={params.clearFilters}
        filters={[
          {
            key: 'category',
            label: 'Category',
            options: COMPLIANCE_CATEGORIES.map((category) => ({
              value: category,
              label: CATEGORY_LABELS[category],
            })),
          },
          {
            key: 'active',
            label: 'Active',
            allLabel: 'Active and inactive',
            options: [
              { value: 'true', label: 'Active only' },
              { value: 'false', label: 'Inactive only' },
            ],
          },
        ]}
      />

      {query.isError ? (
        <ErrorState
          error={query.error}
          title="The catalogue did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <ListToolbar total={query.isPending ? null : rows.length} noun="entry" />

          <DataTable
            caption="Compliance catalogue"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            state={query.isPending ? 'loading' : 'ready'}
            onRowClick={(row) => {
              void navigate(`/settings/catalogue/${row.id}`);
            }}
            rowActions={(row) => (
              <span className="flex items-center justify-end gap-1">
                <IconButton
                  label={`Edit ${row.name}`}
                  size="sm"
                  icon={<Pencil size={14} aria-hidden="true" />}
                  onClick={() => {
                    void navigate(`/settings/catalogue/${row.id}`);
                  }}
                />
                <IconButton
                  label={`Delete ${row.name}`}
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 size={14} aria-hidden="true" />}
                  onClick={() => {
                    confirm.ask({
                      title: `Delete ${row.name}?`,
                      body: 'This only works while nothing references it. If any client service or filing uses it, deactivate it instead.',
                      confirmLabel: 'Delete entry',
                      destructive: true,
                      onConfirm: async () => {
                        await remove.mutateAsync(row.id).catch(() => undefined);
                      },
                    });
                  }}
                />
              </span>
            )}
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
                  icon={<BookOpen size={20} aria-hidden="true" />}
                  title="The catalogue is empty"
                  description="Add the filings your firm tracks. Every client service points at one of these."
                  action={
                    <Button asChild variant="primary" size="sm">
                      <Link to="/settings/catalogue/new">Add entry</Link>
                    </Button>
                  }
                />
              )
            }
          />
        </>
      )}

      {confirm.request === null ? null : (
        <ConfirmDialog
          open={confirm.open}
          onOpenChange={confirm.setOpen}
          title={confirm.request.title}
          body={confirm.request.body}
          confirmLabel={confirm.request.confirmLabel}
          destructive={confirm.request.destructive ?? false}
          pending={confirm.pending}
          onConfirm={confirm.confirm}
        />
      )}
    </>
  );
}
