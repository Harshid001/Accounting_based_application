import { useQuery } from '@tanstack/react-query';
import { PartyPopper } from 'lucide-react';
import { useMemo, useState } from 'react';

import { listMyWork } from '@/api/myWork.api';
import { queryKeys } from '@/api/queryKeys';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkRow } from '@/desktop/my-work/components/WorkRow';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { cn } from '@/lib/cn';
import { pluralise } from '@/lib/format';

export function MyWork() {
  usePageTitle('My work');
  const [tab, setTab] = useState<'all' | 'task' | 'compliance' | 'overdue'>('all');
  const params = useListParams({ filterKeys: [], defaultLimit: 25 });

  const query = useQuery({
    queryKey: queryKeys.myWork(params.query),
    queryFn: ({ signal }) => listMyWork({ page: params.page, limit: params.limit }, signal),
    staleTime: 30_000,
  });

  const rows = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const overdue = rows.filter((row) => row.isOverdue).length;

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (tab === 'task') return row.kind === 'task';
      if (tab === 'compliance') return row.kind === 'compliance';
      if (tab === 'overdue') return row.isOverdue;
      return true;
    });
  }, [rows, tab]);

  return (
    <>
      <PageHeader
        title="My work"
        featureKey="myWork"
        description="Your open tasks and assigned filings in one list, most urgent first."
        meta={
          query.data === undefined ? null : (
            <p className="numeric mt-2 text-xs text-[var(--fd-text-tertiary)]">
              {pluralise(query.data.total, 'open item')}
              {overdue > 0 ? ` Â· ${overdue} overdue on this page` : ''}
            </p>
          )
        }
      />

      {query.isError ? (
        <ErrorState
          error={query.error}
          title="Your work list did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : query.isPending ? (
        <ul className="space-y-2" aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => (
            <li key={index}>
              <Skeleton className="h-16 w-full" rounded="lg" />
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<PartyPopper size={20} aria-hidden="true" />}
          title="Nothing is on your plate"
          description="Every task assigned to you is done and no filing is waiting. Enjoy it while it lasts."
        />
      ) : (
        <>
          <div data-tour="mywork-tabs" className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--fd-border-subtle)] pb-2">
              <button
                type="button"
                onClick={() => setTab('all')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer',
                  tab === 'all'
                    ? 'bg-[var(--fd-accent)] text-[var(--fd-accent-contrast)] font-semibold shadow-xs'
                    : 'bg-[var(--fd-surface-2)] text-[var(--fd-text-secondary)] hover:bg-[var(--fd-surface-3)]',
                )}
              >
                All Work ({rows.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('task')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer',
                  tab === 'task'
                    ? 'bg-[var(--fd-accent)] text-[var(--fd-accent-contrast)] font-semibold shadow-xs'
                    : 'bg-[var(--fd-surface-2)] text-[var(--fd-text-secondary)] hover:bg-[var(--fd-surface-3)]',
                )}
              >
                Tasks Only ({rows.filter((r) => r.kind === 'task').length})
              </button>
              <button
                type="button"
                onClick={() => setTab('compliance')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer',
                  tab === 'compliance'
                    ? 'bg-[var(--fd-accent)] text-[var(--fd-accent-contrast)] font-semibold shadow-xs'
                    : 'bg-[var(--fd-surface-2)] text-[var(--fd-text-secondary)] hover:bg-[var(--fd-surface-3)]',
                )}
              >
                Filings Only ({rows.filter((r) => r.kind === 'compliance').length})
              </button>
              {overdue > 0 && (
                <button
                  type="button"
                  onClick={() => setTab('overdue')}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer',
                    tab === 'overdue'
                      ? 'bg-[var(--fd-status-danger)] text-[var(--fd-accent-contrast)] font-semibold shadow-xs'
                      : 'bg-[var(--fd-surface-2)] text-[var(--fd-status-danger)] hover:bg-[var(--fd-surface-3)]',
                  )}
                >
                  âš¡ Overdue ({overdue})
                </button>
              )}
            </div>

            {filteredRows.length === 0 ? (
              <p className="py-8 text-center text-xs text-[var(--fd-text-tertiary)]">
                No items in this category.
              </p>
            ) : (
              <ul className="space-y-2">
                {filteredRows.map((row) => (
                  <WorkRow key={`${row.kind}-${row.id}`} row={row} />
                ))}
              </ul>
            )}
          </div>

          <Pagination
            page={query.data.page}
            limit={query.data.limit}
            total={query.data.total}
            totalPages={query.data.totalPages}
            onPageChange={params.setPage}
            onLimitChange={params.setLimit}
            label="items"
          />
        </>
      )}
    </>
  );
}
