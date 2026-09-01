import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { fetchDashboard } from '@/api/reports.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { DeadlineBuckets } from '@/routes/dashboard/components/DeadlineBuckets';
import { StatRow } from '@/routes/dashboard/components/StatRow';
import { TaskBreakdown } from '@/routes/dashboard/components/RecentActivity';
import { WorkloadPanel } from '@/routes/dashboard/components/WorkloadPanel';
import { useCurrentUser, useSession } from '@/context/SessionContext';
import { usePageTitle } from '@/hooks/usePageTitle';

export function Dashboard() {
  usePageTitle('Dashboard');
  const user = useCurrentUser();
  const { allows } = useSession();

  const query = useQuery({
    queryKey: queryKeys.reports.dashboard,
    queryFn: fetchDashboard,
    staleTime: 60_000,
  });

  const firstName = user.name.split(' ')[0] ?? user.name;

  return (
    <>
      <PageHeader
        title={`Good to see you, ${firstName}`}
        description={
          user.role === 'admin'
            ? 'Firm-wide figures across every client.'
            : 'Everything below is scoped to the clients assigned to you.'
        }
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link to="/my-work">Open my work</Link>
            </Button>
            {allows('client:create') ? (
              <Button asChild variant="primary" size="sm">
                <Link to="/clients/new">
                  <Plus size={14} aria-hidden="true" />
                  Add client
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      {query.isError ? (
        <ErrorState
          error={query.error}
          title="The dashboard did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <div className="space-y-4">
          <StatRow summary={query.data} loading={query.isPending} />

          <div className="grid gap-4 lg:grid-cols-2">
            <DeadlineBuckets summary={query.data} loading={query.isPending} />
            <TaskBreakdown summary={query.data} loading={query.isPending} />
          </div>

          <WorkloadPanel summary={query.data} loading={query.isPending} />
        </div>
      )}
    </>
  );
}
