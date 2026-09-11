import { useQuery } from '@tanstack/react-query';
import { MessagesSquare, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { listThreads } from '@/api/messages.api';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageTitle } from '@/hooks/usePageTitle';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/date';
import { truncate } from '@/lib/format';

export function MessagesIndex() {
  usePageTitle('Messages');
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.messages.threads,
    queryFn: listThreads,
    staleTime: 20_000,
  });

  const threads = useMemo(() => query.data ?? [], [query.data]);
  const unread = threads.reduce((sum, thread) => sum + thread.unreadCount, 0);

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      if (unreadOnly && t.unreadCount === 0) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        return (
          t.clientName.toLowerCase().includes(q) ||
          (t.lastMessagePreview !== null && t.lastMessagePreview.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [threads, search, unreadOnly]);

  return (
    <>
      <PageHeader
        title="Messages"
        featureKey="messages"
        description="One thread per client. Everything here is visible to the client too."
        meta={
          unread === 0 ? null : (
            <p className="numeric mt-2 text-xs text-[var(--fd-text-tertiary)]">
              {unread} unread across {threads.length} threads
            </p>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="w-full min-w-0 flex-1 sm:w-auto sm:min-w-64">
          <Input
            type="search"
            value={search}
            aria-label="Search conversation threads by client name"
            placeholder="Search threads by client name..."
            prefix={<Search size={14} aria-hidden="true" />}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => setUnreadOnly((prev) => !prev)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border transition-all cursor-pointer',
            unreadOnly
              ? 'bg-[var(--fd-accent)] text-[var(--fd-accent-contrast)] border-[var(--fd-accent)] shadow-xs'
              : 'bg-[var(--fd-surface-2)] text-[var(--fd-text-secondary)] border-[var(--fd-border)] hover:bg-[var(--fd-surface-3)]',
          )}
        >
          <span>Unread only</span>
          {unread > 0 && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                unreadOnly ? 'bg-[var(--fd-accent)]/25 text-[var(--fd-accent-contrast)]' : 'bg-[var(--fd-accent)] text-[var(--fd-accent-contrast)]',
              )}
            >
              {unread}
            </span>
          )}
        </button>
      </div>

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
      ) : filteredThreads.length === 0 ? (
        <Card>
          <EmptyState
            icon={<MessagesSquare size={20} aria-hidden="true" />}
            title={search || unreadOnly ? 'No matching threads found' : 'No conversations yet'}
            description={
              search || unreadOnly
                ? 'Try adjusting your search or clear filters to view all client threads.'
                : 'Open a client record and post the first message. Their linked users see it immediately.'
            }
          />
        </Card>
      ) : (
        <div data-tour="message-thread">
          <ul className="space-y-2">
            {filteredThreads.map((thread) => (
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
        </div>
      )}
    </>
  );
}
