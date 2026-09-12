import { useQuery } from '@tanstack/react-query';
import { CalendarCheck2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { fetchPortalOverview, listPortalActivity } from '@/api/portal.api';
import { queryKeys } from '@/api/queryKeys';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import { ActivityFeed } from '@/components/domain/ActivityFeed';
import { ComplianceStatusPill, OverdueBadge } from '@/components/domain/StatusPills';
import { useActiveClient } from '@/context/ActiveClientContext';
import { useCurrentUser } from '@/context/SessionContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatDate, relativeDeadline } from '@/lib/date';

export function PortalOverview() {
  usePageTitle('Your overview');
  const user = useCurrentUser();
  const { activeClientId, activeClient } = useActiveClient();
  const clientId = activeClientId ?? '';

  const overview = useQuery({
    queryKey: queryKeys.portal.overview(clientId),
    queryFn: fetchPortalOverview,
    enabled: clientId.length > 0,
    staleTime: 30_000,
  });

  const activityParams = { page: 1, limit: 8 };
  const activity = useQuery({
    queryKey: queryKeys.portal.activity(clientId, activityParams),
    queryFn: () => listPortalActivity(activityParams),
    enabled: clientId.length > 0,
    staleTime: 60_000,
  });

  const firstName = user.name.split(' ')[0] ?? user.name;

  return (
    <>
      <PageHeader
        title={`Hello, ${firstName}`}
        featureKey="portal"
        description={
          activeClient === null
            ? 'Here is where your account stands.'
            : `Here is where ${activeClient.displayName} stands.`
        }
      />

      {overview.isError ? (
        <ErrorState
          error={overview.error}
          title="Your overview did not load"
          onRetry={() => {
            void overview.refetch();
          }}
        />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Waiting on you"
              value={overview.data?.awaitingYou ?? null}
              tone={(overview.data?.awaitingYou ?? 0) > 0 ? 'waiting' : 'default'}
              loading={overview.isPending}
              to="/portal/compliance?status=awaiting_client"
            />
            <StatTile
              label="Documents asked for"
              value={overview.data?.openRequests ?? null}
              tone={(overview.data?.openRequests ?? 0) > 0 ? 'waiting' : 'default'}
              loading={overview.isPending}
              to="/portal/requests"
            />
            <StatTile
              label="Due in 30 days"
              value={overview.data?.dueSoon ?? null}
              loading={overview.isPending}
              to="/portal/compliance"
            />
            <StatTile
              label="Overdue"
              value={overview.data?.overdue ?? null}
              tone={(overview.data?.overdue ?? 0) > 0 ? 'danger' : 'default'}
              loading={overview.isPending}
              to="/portal/compliance"
            />
          </div>

          <Card>
            <CardHeader
              title="Coming up"
              description="The next few filings your firm is working on for you."
              actions={
                <Link
                  to="/portal/compliance"
                  className="rounded-sm text-base text-[var(--fd-accent)] hover:underline"
                >
                  See all filings
                </Link>
              }
            />

            {overview.isPending ? null : (overview.data?.upcoming.length ?? 0) === 0 ? (
              <EmptyState
                icon={<CalendarCheck2 size={20} aria-hidden="true" />}
                title="Nothing is due right now"
                description="When your firm schedules the next filing it will appear here."
              />
            ) : (
              <ul className="divide-y divide-[var(--fd-border-subtle)]">
                {(overview.data?.upcoming ?? []).map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-md font-medium text-[var(--fd-text-primary)]">
                        {item.complianceTypeName}
                      </p>
                      <p className="text-xs text-[var(--fd-text-tertiary)]">{item.periodLabel}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ComplianceStatusPill status={item.status} />
                      <OverdueBadge overdue={item.isOverdue} />
                      <span className="numeric text-md text-[var(--fd-text-secondary)]">
                        {formatDate(item.dueDate)}
                      </span>
                      <span className="text-xs text-[var(--fd-text-tertiary)]">
                        {relativeDeadline(item.dueDate)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Recent activity" description="What has changed on your account." />
            {activity.isError ? (
              <ErrorState
                compact
                error={activity.error}
                title="Activity did not load"
                onRetry={() => {
                  void activity.refetch();
                }}
              />
            ) : (
              <ActivityFeed
                loading={activity.isPending}
                emptyTitle="Nothing yet"
                emptyDescription="Changes your firm makes to your account will be listed here."
                entries={(activity.data?.items ?? []).map((entry) => ({
                  id: entry.id,
                  action: entry.action,
                  summary: entry.summary,
                  createdAt: entry.createdAt,
                }))}
              />
            )}
          </Card>
        </div>
      )}
    </>
  );
}
