import { useQuery } from '@tanstack/react-query';
import { CheckSquare, Plus } from 'lucide-react';
import { useState } from 'react';

import { listTasks } from '@/api/tasks.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { FilterBar } from '@/components/domain/FilterBar';
import { ListToolbar } from '@/components/domain/ListToolbar';
import { TaskTable } from '@/routes/tasks/components/TaskTable';
import { TaskFormDialog } from '@/routes/tasks/components/TaskFormDialog';
import { useClientRecord } from '@/routes/clients/ClientRecord';
import { useListParams } from '@/hooks/useListParams';
import { useSession } from '@/context/SessionContext';
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/lib/constants';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/types/enums';

const FILTER_KEYS = ['status', 'priority'] as const;

export function TasksTab() {
  const { clientId, client, readOnly } = useClientRecord();
  const { allows } = useSession();
  const [createOpen, setCreateOpen] = useState(false);

  const params = useListParams({
    filterKeys: FILTER_KEYS,
    defaultSort: 'dueDate:asc',
    labels: { status: 'Status', priority: 'Priority' },
    valueLabels: { status: TASK_STATUS_LABELS, priority: TASK_PRIORITY_LABELS },
  });

  const scoped = { ...params.query, client: clientId };
  const query = useQuery({
    queryKey: queryKeys.tasks.list(scoped),
    queryFn: ({ signal }) => listTasks(scoped, signal),
    staleTime: 30_000,
  });

  const canCreate = allows('task:create') && !readOnly;

  return (
    <div className="space-y-4">
      <FilterBar
        search={params.search}
        onSearchChange={params.setSearch}
        searchPlaceholder="Search task titles"
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
        ]}
      />

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
          <ListToolbar total={query.data?.total ?? null} noun="task">
            {canCreate ? (
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
            ) : null}
          </ListToolbar>

          <TaskTable
            tasks={query.data?.items ?? []}
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
                  icon={<CheckSquare size={20} aria-hidden="true" />}
                  title="No tasks for this client"
                  description={`Track the work you owe ${client.displayName} here. Titles are visible to them unless the task is internal only.`}
                  action={
                    canCreate ? (
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

      <TaskFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        lockedClientId={clientId}
        assignableStaff={client.assignedStaff.map((person) => person.id)}
      />
    </div>
  );
}
