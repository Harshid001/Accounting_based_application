import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listMessages, postMessage } from '@/api/messages.api';
import { queryKeys } from '@/api/queryKeys';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { MessageComposer } from '@/components/domain/MessageComposer';
import { MessageThread } from '@/components/domain/MessageThread';
import { useActiveClient } from '@/context/ActiveClientContext';
import { useToast } from '@/context/ToastContext';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';

export function PortalMessages() {
  usePageTitle('Messages');
  const { activeClientId, activeClient } = useActiveClient();
  const clientId = activeClientId ?? '';
  const queryClient = useQueryClient();
  const { errorToast } = useToast();

  const params = useListParams({ filterKeys: [], defaultLimit: 25 });
  const pageQuery = { page: params.page, limit: params.limit };

  const query = useQuery({
    queryKey: queryKeys.clients.messages(clientId, pageQuery),
    queryFn: () => listMessages(clientId, pageQuery),
    enabled: clientId.length > 0,
    staleTime: 15_000,
  });

  const send = useMutation({
    mutationFn: (body: string) => postMessage(clientId, { body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients.messages(clientId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread });
    },
    onError: (error: unknown) => {
      errorToast(error, 'That message was not sent');
    },
  });

  return (
    <>
      <PageHeader
        title="Messages"
        description={
          activeClient === null
            ? 'One conversation with your firm.'
            : `One conversation with your firm about ${activeClient.displayName}.`
        }
      />

      <div className="space-y-4">
        <Card>
          {query.isError ? (
            <ErrorState
              error={query.error}
              title="Messages did not load"
              onRetry={() => {
                void query.refetch();
              }}
            />
          ) : (
            <MessageThread messages={query.data?.items ?? []} loading={query.isPending} />
          )}

          {query.data === undefined || query.data.total <= query.data.limit ? null : (
            <Pagination
              page={query.data.page}
              limit={query.data.limit}
              total={query.data.total}
              totalPages={query.data.totalPages}
              onPageChange={params.setPage}
              onLimitChange={params.setLimit}
              label="messages"
            />
          )}
        </Card>

        <Card>
          <MessageComposer
            placeholder="Write a message to your firm"
            onSend={async (body) => {
              await send.mutateAsync(body).catch(() => undefined);
            }}
          />
        </Card>
      </div>
    </>
  );
}
