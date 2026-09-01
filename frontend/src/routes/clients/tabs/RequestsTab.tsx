import { useQuery } from '@tanstack/react-query';
import { Inbox, Plus } from 'lucide-react';
import { useState } from 'react';

import { listDocumentRequests } from '@/api/documentRequests.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { FilterBar } from '@/components/domain/FilterBar';
import { ListToolbar } from '@/components/domain/ListToolbar';
import { RequestList } from '@/components/domain/RequestList';
import { RequestForm } from '@/routes/requests/components/RequestForm';
import { useClientRecord } from '@/routes/clients/ClientRecord';
import { useListParams } from '@/hooks/useListParams';
import { useSession } from '@/context/SessionContext';
import { REQUEST_STATUS_LABELS } from '@/lib/constants';
import { DOCUMENT_REQUEST_STATUSES } from '@/types/enums';

const FILTER_KEYS = ['status', 'overdue'] as const;

export function RequestsTab() {
  const { clientId, client, readOnly } = useClientRecord();
  const { allows } = useSession();
  const [createOpen, setCreateOpen] = useState(false);

  const params = useListParams({
    filterKeys: FILTER_KEYS,
    labels: { status: 'Status', overdue: 'Overdue' },
    valueLabels: { status: REQUEST_STATUS_LABELS, overdue: { true: 'Overdue only' } },
  });

  const scoped = { ...params.query, client: clientId };
  const query = useQuery({
    queryKey: queryKeys.documentRequests.list(scoped),
    queryFn: ({ signal }) => listDocumentRequests(scoped, signal),
    staleTime: 30_000,
  });

  const canWrite = allows('document_request:write') && !readOnly;

  return (
    <div className="space-y-4">
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
            options: DOCUMENT_REQUEST_STATUSES.map((status) => ({
              value: status,
              label: REQUEST_STATUS_LABELS[status],
            })),
          },
          {
            key: 'overdue',
            label: 'Overdue',
            allLabel: 'All requests',
            options: [{ value: 'true', label: 'Overdue only' }],
          },
        ]}
      />

      {query.isError ? (
        <ErrorState
          error={query.error}
          title="Requests did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <ListToolbar total={query.data?.total ?? null} noun="request">
            {canWrite ? (
              <Button
                variant="primary"
                size="sm"
                iconLeft={<Plus size={14} aria-hidden="true" />}
                onClick={() => {
                  setCreateOpen(true);
                }}
              >
                Ask for a document
              </Button>
            ) : null}
          </ListToolbar>

          <RequestList
            requests={query.data?.items ?? []}
            loading={query.isPending}
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
                  icon={<Inbox size={20} aria-hidden="true" />}
                  title="Nothing has been asked for"
                  description={`Raise a request and ${client.displayName} can upload straight against it from their portal.`}
                  action={
                    canWrite ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setCreateOpen(true);
                        }}
                      >
                        Ask for a document
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
              label="requests"
            />
          )}
        </>
      )}

      <RequestForm open={createOpen} onOpenChange={setCreateOpen} clientId={clientId} />
    </div>
  );
}
