import { useQuery } from '@tanstack/react-query';
import { ListTodo } from 'lucide-react';

import { listPortalTasks } from '@/api/portal.api';
import { queryKeys } from '@/api/queryKeys';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { DataTable } from '@/components/ui/table';
import type { TableColumn } from '@/components/ui/table';
import { TaskStatusPill } from '@/components/domain/StatusPills';
import { useActiveClient } from '@/context/ActiveClientContext';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatDate } from '@/lib/date';
import type { PortalTaskRow } from '@/types/models';

const COLUMNS: Array<TableColumn<PortalTaskRow>> = [
  {
    id: 'title',
    header: 'Task',
    cell: (row) => <span className="font-medium text-[var(--fd-text-primary)]">{row.title}</span>,
  },
  { id: 'status', header: 'Status', cell: (row) => <TaskStatusPill status={row.status} /> },
  {
    id: 'due',
    header: 'Target date',
    align: 'right',
    cell: (row) => <span className="numeric">{formatDate(row.dueDate, 'No date set')}</span>,
  },
];

export function PortalTasks() {
  usePageTitle('Work in progress');
  const { activeClientId } = useActiveClient();
  const clientId = activeClientId ?? '';
  const params = useListParams({ filterKeys: [], defaultLimit: 25 });
  const pageQuery = { page: params.page, limit: params.limit };

  const query = useQuery({
    queryKey: queryKeys.portal.tasks(clientId, pageQuery),
    queryFn: () => listPortalTasks(pageQuery),
    enabled: clientId.length > 0,
    staleTime: 30_000,
  });

  return (
    <>
      <PageHeader
        title="Work in progress"
        description="What your firm is working on for you. Internal notes and who is doing it stay inside the firm."
      />

      {query.isError ? (
        <ErrorState
          error={query.error}
          title="This list did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <DataTable
            density="comfortable"
            caption="Work in progress"
            columns={COLUMNS}
            rows={query.data?.items ?? []}
            rowKey={(row) => row.id}
            state={query.isPending ? 'loading' : 'ready'}
            emptySlot={
              <EmptyState
                icon={<ListTodo size={20} aria-hidden="true" />}
                title="Nothing in progress"
                description="When your firm starts a piece of work for you, it shows up here."
              />
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
              label="items"
            />
          )}
        </>
      )}
    </>
  );
}
