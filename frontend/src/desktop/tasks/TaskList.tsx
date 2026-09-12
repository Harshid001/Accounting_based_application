import { useQuery } from '@tanstack/react-query';
import { CheckSquare, Plus } from 'lucide-react';
import { useState } from 'react';

import { listTasks } from '@/api/tasks.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { FilterBar } from '@/components/domain/FilterBar';
import { ListToolbar } from '@/components/domain/ListToolbar';
import { TaskTable } from '@/desktop/tasks/components/TaskTable';
import { TaskFormDialog } from '@/desktop/tasks/components/TaskFormDialog';
import { useCurrentUser, useSession } from '@/context/SessionContext';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/lib/constants';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/types/enums';

const FILTER_KEYS = ['status', 'priority', 'assignee', 'overdue'] as const;

export function TaskList() {
  usePageTitle('Tasks');
  const user = useCurrentUser();
  const { allows } = useSession();
  const [createOpen, setCreateOpen] = useState(false);

  const params = useListParams({
    filterKeys: FILTER_KEYS,
    defaultSort: 'dueDate:asc',
    labels: {
      status: 'Status',
      priority: 'Priority',
      assignee: 'Owner',
      overdue: 'Overdue',
    },
    valueLabels: {
      status: TASK_STATUS_LABELS,
      priority: TASK_PRIORITY_LABELS,
      assignee: { [user.id]: 'Me' },
      overdue: { true: 'Overdue only' },
    },
  });

  const query = useQuery({
    queryKey: queryKeys.tasks.list(params.query),
    queryFn: ({ signal }) => listTasks(params.query, signal),
    staleTime: 30_000,
  });

  const presets = [
    {
      id: 'me',
      label: '👤 Assigned to Me',
      active: params.filters.assignee === user.id,
      onClick: () => {
        params.setFilter('assignee', params.filters.assignee === user.id ? null : user.id);
      },
    },
    {
      id: 'high',
      label: '🔥 High Priority',
      active: params.filters.priority === 'high',
      onClick: () => {
        params.setFilter('priority', params.filters.priority === 'high' ? null : 'high');
      },
    },
    {
      id: 'overdue',
      label: '⚡ Overdue',
      active: params.filters.overdue === 'true',
      onClick: () => {
        params.setFilter('overdue', params.filters.overdue === 'true' ? null : 'true');
      },
    },
    {
      id: 'in_progress',
      label: '⏳ In Progress',
      active: params.filters.status === 'in_progress',
      onClick: () => {
        params.setFilter('status', params.filters.status === 'in_progress' ? null : 'in_progress');
      },
    },
    {
      id: 'completed',
      label: '✅ Completed',
      active: params.filters.status === 'completed',
      onClick: () => {
        params.setFilter('status', params.filters.status === 'completed' ? null : 'completed');
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Tasks"
        featureKey="tasks"
        description="Every task in your scope, from filings prep to internal work."
        actions={
          allows('task:create') ? (
            <div data-tour="task-add">
              <Button
                variant="primary"
                size="sm"
                iconLeft={<Plus size={14} aria-hidden="true" />}
                onClick={() => {
                  setCreateOpen(true);
                }}
              >
                Add task
              </Button>
            </div>
          ) : undefined
        }
      />

      <div data-tour="task-search">
        <div data-tour="task-filter">
          <FilterBar
            search={params.search}
            onSearchChange={params.setSearch}
            searchPlaceholder="Search task titles"
            presets={presets}
            values={params.filters}
            onFilterChange={params.setFilter}
            activeFilters={params.activeFilters}
            onClear={params.clearFilters}
            filters={[
              {
                key: 'status',
                label: 'Status',
                options: TASK_STATUSES.map((status) => ({
                  value: status,
                  label: TASK_STATUS_LABELS[status],
                })),
              },
              {
                key: 'priority',
                label: 'Priority',
                options: TASK_PRIORITIES.map((priority) => ({
                  value: priority,
                  label: TASK_PRIORITY_LABELS[priority],
                })),
              },
              {
                key: 'assignee',
                label: 'Owner',
                allLabel: 'Anyone',
                options: [{ value: user.id, label: 'Assigned to me' }],
              },
              {
                key: 'overdue',
                label: 'Overdue',
                allLabel: 'All tasks',
                options: [{ value: 'true', label: 'Overdue only' }],
              },
            ]}
          />
        </div>
      </div>

      {query.isError ? (
        <ErrorState
          error={query.error}
          title="Tasks did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <ListToolbar total={query.data?.total ?? null} noun="task" />

          <div data-tour="task-table">
            <TaskTable
            tasks={query.data?.items ?? []}
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
                  icon={<CheckSquare size={20} aria-hidden="true" />}
                  title="No tasks yet"
                  description="Tasks are how the firm tracks work that is not a statutory filing."
                  action={
                    allows('task:create') ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setCreateOpen(true);
                        }}
                      >
                        Add task
                      </Button>
                    ) : undefined
                  }
                />
              )
            }
          />
          </div>

          {query.data === undefined || query.data.total === 0 ? null : (
            <Pagination
              page={query.data.page}
              limit={query.data.limit}
              total={query.data.total}
              totalPages={query.data.totalPages}
              onPageChange={params.setPage}
              onLimitChange={params.setLimit}
              label="tasks"
            />
          )}
        </>
      )}

      <TaskFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
