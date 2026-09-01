import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { DataTable } from '@/components/ui/table';
import type { TableColumn } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ComplianceStatusPill, OverdueBadge } from '@/components/domain/StatusPills';
import { CATEGORY_LABELS } from '@/lib/constants';
import { formatDate, relativeDeadline } from '@/lib/date';
import type { ComplianceListRow } from '@/types/models';

export interface ComplianceTableProps {
  items: readonly ComplianceListRow[];
  loading: boolean;
  emptySlot: ReactNode;
  showClient?: boolean;
  sort: { field: string; direction: 'asc' | 'desc' } | null;
  onSortChange: (field: string) => void;
}

export function ComplianceTable({
  items,
  loading,
  emptySlot,
  showClient = true,
  sort,
  onSortChange,
}: ComplianceTableProps) {
  const navigate = useNavigate();

  const columns: Array<TableColumn<ComplianceListRow>> = [
    {
      id: 'filing',
      header: 'Filing',
      cell: (row) => (
        <span className="min-w-0">
          <Link
            to={`/compliance/${row.id}`}
            className="block truncate rounded-sm font-medium text-[var(--fd-text-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]"
          >
            {row.complianceType?.name ?? 'Unknown filing'}
          </Link>
          <span className="text-2xs block text-[var(--fd-text-tertiary)]">
            {row.periodLabel}
            {row.complianceType === null
              ? ''
              : ` · ${CATEGORY_LABELS[row.complianceType.category]}`}
          </span>
        </span>
      ),
    },
    ...(showClient
      ? [
          {
            id: 'client',
            header: 'Client',
            hideBelow: 'md' as const,
            cell: (row: ComplianceListRow) =>
              row.client === null ? (
                '—'
              ) : (
                <Link
                  to={`/clients/${row.client.id}/compliance`}
                  className="rounded-sm text-[var(--fd-text-secondary)] hover:underline"
                >
                  {row.client.name}
                </Link>
              ),
          },
        ]
      : []),
    {
      id: 'due',
      header: 'Due',
      sortField: 'dueDate',
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="numeric">{formatDate(row.dueDate)}</span>
          {row.dueDateOverridden ? <Badge tone="neutral">Overridden</Badge> : null}
          <OverdueBadge overdue={row.isOverdue} />
          {row.isOverdue || row.dueDate === null ? null : (
            <span className="text-2xs hidden text-[var(--fd-text-tertiary)] lg:inline">
              {relativeDeadline(row.dueDate)}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <ComplianceStatusPill status={row.status} />,
    },
    {
      id: 'documents',
      header: 'Documents',
      align: 'right',
      hideBelow: 'lg',
      cell: (row) =>
        row.requestProgress.total === 0 ? (
          <span className="text-[var(--fd-text-tertiary)]">None asked</span>
        ) : (
          <span className="numeric text-[var(--fd-text-secondary)]">
            {row.requestProgress.received} of {row.requestProgress.total} received
          </span>
        ),
    },
    {
      id: 'assignee',
      header: 'Owner',
      hideBelow: 'lg',
      cell: (row) => (
        <span className="text-[var(--fd-text-secondary)]">
          {row.assignedStaff?.name ?? 'Unassigned'}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      caption="Compliance filings"
      columns={columns}
      rows={items}
      rowKey={(row) => row.id}
      state={loading ? 'loading' : 'ready'}
      emptySlot={emptySlot}
      sort={sort}
      onSortChange={onSortChange}
      onRowClick={(row) => {
        void navigate(`/compliance/${row.id}`);
      }}
    />
  );
}
