import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, Timer } from 'lucide-react';

import { listJobRuns, runJob } from '@/api/jobs.api';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { DataTable } from '@/components/ui/table';
import type { TableColumn } from '@/components/ui/table';
import { SettingsNav } from '@/routes/settings/components/SettingsNav';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/context/ToastContext';
import { JOB_LABELS } from '@/lib/constants';
import { formatDateTime, relativeTime } from '@/lib/date';
import { JOB_NAMES } from '@/types/enums';
import type { JobName } from '@/types/enums';
import type { JobRunView } from '@/types/models';

const SCHEDULE: Record<JobName, string> = {
  generateComplianceItems: 'Daily at 02:00 IST',
  rollRecurringTasks: 'Daily at 02:30 IST',
  purgeUnlinkedAccounts: 'Daily at 03:00 IST',
  sendDeadlineReminders: 'Daily at 07:00 IST',
  sendAdminDigest: 'Daily at 08:00 IST',
};

const TONE = {
  succeeded: 'done',
  running: 'accent',
  failed: 'danger',
} as const;

export function Jobs() {
  usePageTitle('Scheduled jobs');
  const queryClient = useQueryClient();
  const { success, errorToast } = useToast();

  const params = useListParams({ filterKeys: [], defaultLimit: 25 });
  const listQuery = { page: params.page, limit: params.limit };

  const query = useQuery({
    queryKey: queryKeys.jobs.list(listQuery),
    queryFn: () => listJobRuns(listQuery),
    staleTime: 15_000,
  });

  const trigger = useMutation({
    mutationFn: runJob,
    onSuccess: (outcome) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      success(
        `${JOB_LABELS[outcome.jobName]} finished`,
        outcome.error === null ? undefined : outcome.error,
      );
    },
    onError: (error: unknown) => {
      errorToast(error, 'That job did not run');
    },
  });

  const columns: Array<TableColumn<JobRunView>> = [
    { id: 'job', header: 'Job', cell: (row) => JOB_LABELS[row.jobName] },
    {
      id: 'status',
      header: 'Result',
      cell: (row) => <Badge tone={TONE[row.status]}>{row.status}</Badge>,
    },
    {
      id: 'started',
      header: 'Started',
      cell: (row) => (
        <span className="numeric" title={formatDateTime(row.startedAt)}>
          {relativeTime(row.startedAt)}
        </span>
      ),
    },
    {
      id: 'duration',
      header: 'Took',
      align: 'right',
      hideBelow: 'md',
      cell: (row) => (
        <span className="numeric">
          {row.durationMs === null ? '—' : `${(row.durationMs / 1000).toFixed(1)} s`}
        </span>
      ),
    },
    {
      id: 'detail',
      header: 'Detail',
      hideBelow: 'lg',
      cell: (row) => (
        <span className="block truncate text-[var(--fd-text-secondary)]">
          {row.error ?? (row.result === null ? '—' : JSON.stringify(row.result))}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Scheduled jobs"
        description="Every job runs behind a database lock, so a manual trigger can never double-run."
      />
      <SettingsNav />

      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Run a job now"
            description="Useful after changing a catalogue rule, or to recover from a missed night."
          />
          <ul className="divide-y divide-[var(--fd-border-subtle)]">
            {JOB_NAMES.map((name) => (
              <li key={name} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-base font-medium text-[var(--fd-text-primary)]">
                    {JOB_LABELS[name]}
                  </p>
                  <p className="text-2xs flex items-center gap-1 text-[var(--fd-text-tertiary)]">
                    <Timer size={11} aria-hidden="true" />
                    {SCHEDULE[name]}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={trigger.isPending && trigger.variables === name}
                  loadingLabel={`Running ${JOB_LABELS[name]}`}
                  iconLeft={<Play size={14} aria-hidden="true" />}
                  onClick={() => {
                    trigger.mutate(name);
                  }}
                >
                  Run now
                </Button>
              </li>
            ))}
          </ul>
        </Card>

        {query.isError ? (
          <ErrorState
            error={query.error}
            title="Job history did not load"
            onRetry={() => {
              void query.refetch();
            }}
          />
        ) : (
          <>
            <DataTable
              caption="Recent job runs"
              columns={columns}
              rows={query.data?.items ?? []}
              rowKey={(row) => row.id}
              state={query.isPending ? 'loading' : 'ready'}
              emptySlot={
                <EmptyState
                  title="No runs recorded yet"
                  description="The scheduler writes a row for every run, successful or not."
                />
              }
            />

            {query.data === undefined || query.data.total === 0 ? null : (
              <Pagination
                page={query.data.page}
                limit={query.data.limit}
                total={query.data.total}
                totalPages={query.data.totalPages}
                onPageChange={params.setPage}
                onLimitChange={params.setLimit}
                label="runs"
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
