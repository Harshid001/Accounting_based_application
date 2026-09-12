import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOff, CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/notifications.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { EmptyState, FilteredEmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { FilterBar } from '@/components/domain/FilterBar';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/date';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/context/ToastContext';

export function NotificationsIndex() {
  usePageTitle('Notifications');
  const queryClient = useQueryClient();
  const { errorToast } = useToast();

  const params = useListParams({
    filterKeys: ['unread'],
    labels: { unread: 'Unread' },
    valueLabels: { unread: { true: 'Unread only' } },
  });

  const query = useQuery({
    queryKey: queryKeys.notifications.list(params.query),
    queryFn: () => listNotifications(params.query),
    staleTime: 15_000,
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
  };

  const markOne = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: invalidate,
    onError: (error: unknown) => {
      errorToast(error, 'That notification was not marked read');
    },
  });

  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: invalidate,
    onError: (error: unknown) => {
      errorToast(error, 'Marking everything read did not work');
    },
  });

  const rows = query.data?.items ?? [];
  const unread = rows.filter((row) => !row.read).length;

  const presets = [
    {
      id: 'all',
      label: 'All Alerts',
      active: !params.filters.unread,
      onClick: () => {
        params.setFilter('unread', null);
      },
    },
    {
      id: 'unread',
      label: '⚡ Unread Only',
      count: unread,
      active: params.filters.unread === 'true',
      onClick: () => {
        params.setFilter('unread', params.filters.unread === 'true' ? null : 'true');
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Notifications"
        featureKey="notifications"
        description="Everything FirmDesk has flagged for you, newest first."
        actions={
          <Button
            variant="secondary"
            size="sm"
            disabled={unread === 0}
            loading={markAll.isPending}
            loadingLabel="Marking everything read"
            iconLeft={<CheckCheck size={14} aria-hidden="true" />}
            onClick={() => {
              markAll.mutate();
            }}
          >
            Mark all read
          </Button>
        }
      />

      <FilterBar
        showSearch={false}
        search=""
        onSearchChange={() => undefined}
        presets={presets}
        values={params.filters}
        onFilterChange={params.setFilter}
        activeFilters={params.activeFilters}
        onClear={params.clearFilters}
        filters={[
          {
            key: 'unread',
            label: 'Unread',
            allLabel: 'Everything',
            options: [{ value: 'true', label: 'Unread only' }],
          },
        ]}
      />

      {query.isError ? (
        <ErrorState
          error={query.error}
          title="Notifications did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : query.isPending ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" rounded="lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        params.hasFilters ? (
          <FilteredEmptyState
            activeFilters={params.activeFilters.map(
              (filter) => `${filter.label}: ${filter.value}`,
            )}
            onClear={params.clearFilters}
          />
        ) : (
          <EmptyState
            icon={<BellOff size={20} aria-hidden="true" />}
            title="Nothing to catch up on"
            description="Assignments, messages and approaching deadlines will land here."
          />
        )
      ) : (
        <>
          <ul className="space-y-2">
            {rows.map((notification) => (
              <li key={notification.id}>
                <Link
                  to={notification.link}
                  onClick={() => {
                    if (!notification.read) markOne.mutate(notification.id);
                  }}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]',
                    notification.read
                      ? 'border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] hover:bg-[var(--fd-surface-3)]'
                      : 'border-[var(--fd-accent)] bg-[var(--fd-accent-subtle-bg)]',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      notification.read ? 'bg-transparent' : 'bg-[var(--fd-accent)]',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-medium text-[var(--fd-text-primary)]">
                      {notification.title}
                      {notification.read ? null : <span className="sr-only"> (unread)</span>}
                    </span>
                    {notification.body === null ? null : (
                      <span className="block text-xs text-[var(--fd-text-secondary)]">
                        {notification.body}
                      </span>
                    )}
                  </span>
                  <time
                    dateTime={notification.createdAt ?? undefined}
                    className="text-2xs shrink-0 text-[var(--fd-text-tertiary)]"
                  >
                    {relativeTime(notification.createdAt)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination
            page={query.data.page}
            limit={query.data.limit}
            total={query.data.total}
            totalPages={query.data.totalPages}
            onPageChange={params.setPage}
            onLimitChange={params.setLimit}
            label="notifications"
          />
        </>
      )}
    </>
  );
}
