import { useQuery } from '@tanstack/react-query';
import { ArrowRightLeft, CalendarClock, CheckSquare, Plus } from 'lucide-react';
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
import { useLanguage } from '@/context/LanguageContext';
import { usePageTitle } from '@/hooks/usePageTitle';

export function Dashboard() {
  usePageTitle('Dashboard');
  const user = useCurrentUser();
  const { allows } = useSession();
  const { t } = useLanguage();

  const query = useQuery({
    queryKey: queryKeys.reports.dashboard,
    queryFn: fetchDashboard,
    staleTime: 60_000,
  });

  const firstName = user.name.split(' ')[0] ?? user.name;

  return (
    <>
      <PageHeader
        title={`${t('dashboard.greeting', 'Good to see you')}, ${firstName}`}
        featureKey="dashboard"
        description={
          user.role === 'admin'
            ? t('dashboard.descAdmin', 'Firm-wide figures across every client.')
            : t('dashboard.descUser', 'Everything below is scoped to the clients assigned to you.')
        }
        actions={
          <>
            <div data-tour="dashboard-mywork">
              <Button asChild variant="secondary" size="sm">
                <Link to="/my-work">{t('dashboard.openMyWork', 'Open my work')}</Link>
              </Button>
            </div>
            {allows('client:create') ? (
              <div data-tour="dashboard-addclient">
                <Button asChild variant="primary" size="sm">
                  <Link to="/clients/new">
                    <Plus size={14} aria-hidden="true" />
                    {t('dashboard.addClient', 'Add client')}
                  </Link>
                </Button>
              </div>
            ) : null}
          </>
        }
      />

      {query.isError ? (
        <ErrorState
          error={query.error}
          title={t('dashboard.errorLoad', 'The dashboard did not load')}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <div className="space-y-4">
          {/* Daily Quick Launch Actions */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] p-2.5 shadow-2xs">
            <span className="px-2 text-xs font-bold uppercase tracking-wider text-[var(--fd-text-tertiary)]">
              Quick Actions:
            </span>
            {allows('task:create') && (
              <Button asChild variant="secondary" size="sm">
                <Link to="/tasks" className="flex items-center gap-1.5">
                  <CheckSquare size={13} className="text-[var(--fd-accent)]" />
                  <span>New Task</span>
                </Link>
              </Button>
            )}
            {allows('compliance:bulk') && (
              <Button asChild variant="secondary" size="sm">
                <Link to="/compliance/generate" className="flex items-center gap-1.5">
                  <CalendarClock size={13} className="text-[var(--fd-status-done)]" />
                  <span>Generate Filings</span>
                </Link>
              </Button>
            )}
            {allows('document:read') && (
              <Button asChild variant="secondary" size="sm">
                <Link to="/converter" className="flex items-center gap-1.5">
                  <ArrowRightLeft size={13} className="text-[var(--fd-status-progress)]" />
                  <span>Convert File</span>
                </Link>
              </Button>
            )}
          </div>

          <div data-tour="dashboard-stats">
            <StatRow summary={query.data} loading={query.isPending} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div data-tour="dashboard-buckets">
              <DeadlineBuckets summary={query.data} loading={query.isPending} />
            </div>
            <TaskBreakdown summary={query.data} loading={query.isPending} />
          </div>

          <div data-tour="dashboard-workload">
            <WorkloadPanel summary={query.data} loading={query.isPending} />
          </div>
        </div>
      )}
    </>
  );
}
