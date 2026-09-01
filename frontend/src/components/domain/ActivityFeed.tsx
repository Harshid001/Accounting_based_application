import { History } from 'lucide-react';

import { AUDIT_ACTION_LABELS } from '@/lib/constants';
import { formatDateTime, relativeTime } from '@/lib/date';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

export interface ActivityEntry {
  id: string;
  action: string;
  summary: string | null;
  actorName?: string | null;
  createdAt: string | null;
}

export interface ActivityFeedProps {
  entries: readonly ActivityEntry[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ActivityFeed({
  entries,
  loading = false,
  emptyTitle = 'Nothing has happened yet',
  emptyDescription = 'Every change to this record will show up here as it happens.',
}: ActivityFeedProps) {
  if (loading) {
    return (
      <ul className="space-y-3" aria-busy="true">
        {Array.from({ length: 5 }, (_, index) => (
          <li key={index} className="space-y-1.5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </li>
        ))}
      </ul>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<History size={20} aria-hidden="true" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-[var(--fd-border-subtle)] pl-4">
      {entries.map((entry) => (
        <li key={entry.id} data-print="row" className="relative">
          <span
            aria-hidden="true"
            className="absolute top-1.5 -left-[21px] h-2 w-2 rounded-full bg-[var(--fd-border-strong)]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</Badge>
            <time
              dateTime={entry.createdAt ?? undefined}
              title={formatDateTime(entry.createdAt)}
              className="text-2xs text-[var(--fd-text-tertiary)]"
            >
              {relativeTime(entry.createdAt)}
            </time>
            {entry.actorName === null || entry.actorName === undefined ? null : (
              <span className="text-2xs text-[var(--fd-text-tertiary)]">by {entry.actorName}</span>
            )}
          </div>
          <p className="mt-1 text-base text-[var(--fd-text-primary)]">
            {entry.summary ?? 'No further detail was recorded.'}
          </p>
        </li>
      ))}
    </ol>
  );
}
