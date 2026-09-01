import { useQuery } from '@tanstack/react-query';

import { listClientActivity } from '@/api/clients.api';
import { queryKeys } from '@/api/queryKeys';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { ActivityFeed } from '@/components/domain/ActivityFeed';
import { useClientRecord } from '@/routes/clients/ClientRecord';
import { useListParams } from '@/hooks/useListParams';

export function ActivityTab() {
  const { clientId, client } = useClientRecord();
  const params = useListParams({ filterKeys: [], defaultLimit: 25 });
  const pageQuery = { page: params.page, limit: params.limit };

  const query = useQuery({
    queryKey: queryKeys.clients.activity(clientId, pageQuery),
    queryFn: () => listClientActivity(clientId, pageQuery),
    staleTime: 30_000,
  });

  return (
    <Card>
      {query.isError ? (
        <ErrorState
          error={query.error}
          title="Activity did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          <ActivityFeed
            loading={query.isPending}
            emptyTitle="No activity yet"
            emptyDescription={`Every change to ${client.displayName} will be recorded here, with who made it and when.`}
            entries={(query.data?.items ?? []).map((entry) => ({
              id: entry.id,
              action: entry.action,
              summary: entry.summary,
              actorName: entry.actor?.name ?? null,
              createdAt: entry.createdAt,
            }))}
          />

          {query.data === undefined || query.data.total === 0 ? null : (
            <Pagination
              page={query.data.page}
              limit={query.data.limit}
              total={query.data.total}
              totalPages={query.data.totalPages}
              onPageChange={params.setPage}
              onLimitChange={params.setLimit}
              label="entries"
            />
          )}
        </>
      )}
    </Card>
  );
}
