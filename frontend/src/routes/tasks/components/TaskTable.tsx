import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { DataTable } from '@/components/ui/table';
import type { TableColumn } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { OverdueBadge, PriorityBadge, TaskStatusPill } from '@/components/domain/StatusPills';
import { formatDate } from '@/lib/date';
import type { TaskListRow } from '@/types/models';

export interface TaskTableProps {
  tasks: readonly TaskListRow[];
  loading: boolean;
  emptySlot: ReactNode;
  showClient?: boolean;
  sort: { field: string; direction: 'asc' | 'desc' } | null;
  onSortChange: (field: string) => void;
}

export function TaskTable({
  tasks,
  loading,
  emptySlot,
  showClient = true,
  sort,
  onSortChange,
}: TaskTableProps) {
  const navigate = useNavigate();

  const columns: Array<TableColumn<TaskListRow>> = [
    {
      id: 'title',
      header: 'Task',
      cell: (row) => (
        <span className="min-w-0">
          <Link
            to={`/tasks/${row.id}`}
            className="block truncate rounded-sm font-medium text-[var(--fd-text-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]"
          >
            {row.title}
          </Link>
          <span className="text-2xs flex flex-wrap items-center gap-2 text-[var(--fd-text-tertiary)]">
            {row.checklistTotal > 0 ? (
              <span className="numeric">
                {row.checklistDone} of {row.checklistTotal} sub-tasks
              </span>
            ) : null}
            {row.blockedCount > 0 ? (
              <span className="numeric">blocked by {row.blockedCount}</span>
            ) : null}
            {row.internalOnly ? <Badge tone="muted">Internal only</Badge> : null}
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
            cell: (row: TaskListRow) =>
              row.client === null ? (
                <span className="text-[var(--fd-text-tertiary)]">Internal work</span>
              ) : (
                <Link
                  to={`/clients/${row.client.id}/tasks`}
                  className="rounded-sm text-[var(--fd-text-secondary)] hover:underline"
                >
                  {row.client.name}
                </Link>
              ),
          },
        ]
      : []),
    {
      id: 'assignee',
      header: 'Owner',
      hideBelow: 'lg',
      cell: (row) => (
        <span className="text-[var(--fd-text-secondary)]">
          {row.assignee?.name ?? 'Unassigned'}
        </span>
      ),
    },
    {
      id: 'priority',
      header: 'Priority',
      sortField: 'priority',
      hideBelow: 'lg',
      cell: (row) => <PriorityBadge priority={row.priority} />,
    },
    {
      id: 'due',
      header: 'Due',
      sortField: 'dueDate',
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="numeric">{formatDate(row.dueDate, 'No due date')}</span>
          <OverdueBadge overdue={row.isOverdue} />
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortField: 'status',
      cell: (row) => <TaskStatusPill status={row.status} />,
    },
  ];

  return (
    <DataTable
      caption="Tasks"
      columns={columns}
      rows={tasks}
      rowKey={(row) => row.id}
      state={loading ? 'loading' : 'ready'}
      emptySlot={emptySlot}
      sort={sort}
      onSortChange={onSortChange}
      onRowClick={(row) => {
        void navigate(`/tasks/${row.id}`);
      }}
    />
  );
}
