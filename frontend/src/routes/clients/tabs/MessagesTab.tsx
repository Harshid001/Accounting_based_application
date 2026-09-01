import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listMessages, postMessage } from '@/api/messages.api';
import { queryKeys } from '@/api/queryKeys';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { MessageComposer } from '@/components/domain/MessageComposer';
import { MessageThread } from '@/components/domain/MessageThread';
import { useClientRecord } from '@/routes/clients/ClientRecord';
import { useListParams } from '@/hooks/useListParams';
import { useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';

export function MessagesTab() {
  const { clientId, readOnly } = useClientRecord();
  const queryClient = useQueryClient();
  const { allows } = useSession();
  const { errorToast } = useToast();

  const params = useListParams({ filterKeys: [], defaultLimit: 25 });
  const pageQuery = { page: params.page, limit: params.limit };

  const query = useQuery({
    queryKey: queryKeys.clients.messages(clientId, pageQuery),
    queryFn: () => listMessages(clientId, pageQuery),
    staleTime: 15_000,
  });

  const send = useMutation({
    mutationFn: (body: string) => postMessage(clientId, { body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients.messages(clientId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread });
      void queryClient.invalidateQueries({ queryKey: queryKeys.messages.threads });
    },
    onError: (error: unknown) => {
      errorToast(error, 'That message was not sent');
    },
  });

  return (
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
          <MessageThread
            messages={query.data?.items ?? []}
            loading={query.isPending}
            contextLinkFor={(kind, id) =>
              kind === 'compliance_item' ? `/compliance/${id}` : `/clients/${clientId}/requests`
            }
          />
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
          disabled={!allows('message:write') || readOnly}
          disabledReason={
            readOnly
              ? 'This client is archived, so the thread is read-only.'
              : 'You cannot post to this thread.'
          }
          onSend={async (body) => {
            await send.mutateAsync(body).catch(() => undefined);
          }}
        />
      </Card>
    </div>
  );
}
