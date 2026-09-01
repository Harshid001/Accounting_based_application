import { useQuery } from '@tanstack/react-query';
import { PartyPopper } from 'lucide-react';

import { listMyWork } from '@/api/myWork.api';
import { queryKeys } from '@/api/queryKeys';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkRow } from '@/routes/my-work/components/WorkRow';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { pluralise } from '@/lib/format';

export function MyWork() {
  usePageTitle('My work');
  const params = useListParams({ filterKeys: [], defaultLimit: 25 });

  const query = useQuery({
    queryKey: queryKeys.myWork(params.query),
    queryFn: ({ signal }) => listMyWork({ page: params.page, limit: params.limit }, signal),
    staleTime: 30_000,
  });

  const rows = query.data?.items ?? [];
  const overdue = rows.filter((row) => row.isOverdue).length;

  return (
    <>
      <PageHeader
        title="My work"
        description="Your open tasks and assigned filings in one list, most urgent first."
        meta={
          query.data === undefined ? null : (
            <p className="numeric mt-2 text-xs text-[var(--fd-text-tertiary)]">
              {pluralise(query.data.total, 'open item')}
              {overdue > 0 ? ` · ${overdue} overdue on this page` : ''}
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
          <ul className="space-y-2">
            {rows.map((row) => (
              <WorkRow key={`${row.kind}-${row.id}`} row={row} />
            ))}
          </ul>

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
