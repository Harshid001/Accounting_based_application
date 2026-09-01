import { useQuery } from '@tanstack/react-query';
import { MessagesSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

import { listThreads } from '@/api/messages.api';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageTitle } from '@/hooks/usePageTitle';
import { relativeTime } from '@/lib/date';
import { truncate } from '@/lib/format';

export function MessagesIndex() {
  usePageTitle('Messages');

  const query = useQuery({
    queryKey: queryKeys.messages.threads,
    queryFn: listThreads,
    staleTime: 20_000,
  });

  const threads = query.data ?? [];
  const unread = threads.reduce((sum, thread) => sum + thread.unreadCount, 0);

  return (
    <>
      <PageHeader
        title="Messages"
        description="One thread per client. Everything here is visible to the client too."
        meta={
          unread === 0 ? null : (
            <p className="numeric mt-2 text-xs text-[var(--fd-text-tertiary)]">
              {unread} unread across {threads.length} threads
            </p>
          )
        }
      />

      {query.isError ? (
        <ErrorState
          error={query.error}
          title="Threads did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : query.isPending ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" rounded="lg" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <Card>
          <EmptyState
            icon={<MessagesSquare size={20} aria-hidden="true" />}
            title="No conversations yet"
            description="Open a client record and post the first message. Their linked users see it immediately."
          />
        </Card>
      ) : (
        <ul className="space-y-2">
          {threads.map((thread) => (
            <li key={thread.clientId}>
              <Link
                to={`/clients/${thread.clientId}/messages`}
                className="flex items-center gap-3 rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] px-4 py-3 transition-colors hover:bg-[var(--fd-surface-3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-base font-medium text-[var(--fd-text-primary)]">
                      {thread.clientName}
                    </span>
                    {thread.unreadCount > 0 ? (
                      <Badge tone="accent">{thread.unreadCount} unread</Badge>
                    ) : null}
                  </span>
                  <span className="text-2xs block truncate text-[var(--fd-text-tertiary)]">
                    {thread.lastMessagePreview === null
                      ? 'No messages yet'
                      : truncate(thread.lastMessagePreview, 120)}
                  </span>
                </span>
                <span className="text-2xs shrink-0 text-[var(--fd-text-tertiary)]">
                  {relativeTime(thread.lastMessageAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
