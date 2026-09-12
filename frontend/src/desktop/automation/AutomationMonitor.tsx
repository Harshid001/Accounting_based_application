import { useQuery } from '@tanstack/react-query';
import { Bot, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

import { getAutomationSupport, listAutomationRuns } from '@/api/automation.api';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/table';
import type { TableColumn } from '@/components/ui/table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { relativeTime, formatDateTime } from '@/lib/date';
import type { AutomationRunView } from '@/types/models';

const STATUS_TONE: Record<string, 'accent' | 'waiting' | 'done' | 'danger' | 'neutral'> = {
  queued: 'neutral',
  starting: 'neutral',
  running: 'accent',
  waiting_human: 'waiting',
  succeeded: 'done',
  failed: 'danger',
  aborted: 'neutral',
};

const LIVE_STATUSES = ['queued', 'starting', 'running', 'waiting_human'];

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  starting: 'Starting',
  running: 'Running',
  waiting_human: 'Waiting for you',
  succeeded: 'Succeeded',
  failed: 'Failed',
  aborted: 'Aborted',
};

export function AutomationMonitor() {
  usePageTitle('Portal automation');
  const isLive = (status: string): boolean => LIVE_STATUSES.includes(status);

  const runsQuery = useQuery({
    queryKey: queryKeys.automation.list({ limit: 50 }),
    queryFn: () => listAutomationRuns({ limit: 50 }),
    refetchInterval: 10_000,
  });

  const supportQuery = useQuery({
    queryKey: queryKeys.automation.support,
    queryFn: getAutomationSupport,
    staleTime: 60_000,
  });

  const runs = runsQuery.data ?? [];
  const liveRuns = runs.filter((run) => isLive(run.status));
  const support = supportQuery.data;

  const columns: Array<TableColumn<AutomationRunView>> = [
    {
      id: 'form',
      header: 'Filing',
      cell: (row) => (
        <Link
          to={`/compliance/${row.complianceItemId}`}
          className="font-medium text-[var(--fd-text-primary)] underline-offset-2 hover:underline"
        >
          {row.form}
        </Link>
      ),
    },
    {
      id: 'portal',
      header: 'Portal',
      hideBelow: 'sm',
      cell: (row) => <span className="text-[var(--fd-text-secondary)]">{row.portal}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>
          {STATUS_LABEL[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      id: 'progress',
      header: 'Steps',
      align: 'right',
      hideBelow: 'md',
      cell: (row) => (
        <span className="numeric">
          {row.stepsCompleted}/{row.totalSteps}
        </span>
      ),
    },
    {
      id: 'arn',
      header: 'ARN',
      hideBelow: 'lg',
      cell: (row) => (
        <span className="numeric text-[var(--fd-text-secondary)]">
          {row.result.arn ?? '—'}
        </span>
      ),
    },
    {
      id: 'error',
      header: 'Detail',
      hideBelow: 'lg',
      cell: (row) => (
        <span className="block max-w-[16rem] truncate text-[var(--fd-text-secondary)]" title={row.error ?? undefined}>
          {row.error ?? '—'}
        </span>
      ),
    },
    {
      id: 'started',
      header: 'Started',
      align: 'right',
      cell: (row) => (
        <span className="numeric" title={formatDateTime(row.createdAt)}>
          {relativeTime(row.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Portal automation"
        description="Firm-wide browser automation runs: live progress, handoffs waiting on you, and recipe coverage."
      />

      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader
              title="Browser worker capacity"
              description={
                support === undefined
                  ? 'Loading…'
                  : `${support.activeCapacity} of ${support.maxCapacity} browser slots busy.`
              }
            />
            <p className="text-3xl font-semibold text-[var(--fd-text-primary)]">
              {support === undefined ? '—' : `${liveRuns.length} live`}
            </p>
            <p className="text-2xs text-[var(--fd-text-tertiary)]">
              {liveRuns.length > 0
                ? 'Runs waiting for OTP / CAPTCHA / password show as "Waiting for you" — open the filing to complete the handoff.'
                : 'No active runs right now. Launch one from a filing\u0027s guided filing card or the AI Copilot.'}
            </p>
          </Card>

          <Card>
            <CardHeader
              title="Automation coverage"
              description="Forms the browser worker can file today; everything else uses the manual guide."
            />
            {supportQuery.isPending ? (
              <p className="text-sm text-[var(--fd-text-tertiary)]">Loading…</p>
            ) : supportQuery.isError ? (
              <ErrorState
                error={supportQuery.error}
                title="Coverage did not load"
                onRetry={() => {
                  void supportQuery.refetch();
                }}
              />
            ) : (
              <ul className="space-y-1.5">
                {support!.supportedForms.map((form) => (
                  <li key={`${form.portal}/${form.form}`} className="flex items-center gap-2 text-sm">
                    <Badge tone="done">Automatable</Badge>
                    <span className="font-medium text-[var(--fd-text-primary)]">{form.form}</span>
                    <span className="text-[var(--fd-text-tertiary)]">
                      {form.portal} · recipe v{form.recipeVersion}
                    </span>
                  </li>
                ))}
                {support!.knownForms
                  .filter((f) => !f.supported)
                  .slice(0, 4)
                  .map((f) => (
                    <li key={f.formCode} className="flex items-center gap-2 text-sm">
                      <Badge tone="muted">Manual</Badge>
                      <span className="text-[var(--fd-text-secondary)]">{f.formCode}</span>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>

        {runsQuery.isError ? (
          <ErrorState
            error={runsQuery.error}
            title="Runs did not load"
            onRetry={() => {
              void runsQuery.refetch();
            }}
          />
        ) : (
          <>
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<RefreshCw size={14} aria-hidden="true" />}
                onClick={() => {
                  void runsQuery.refetch();
                }}
              >
                Refresh
              </Button>
            </div>
            <DataTable
              caption="Automation runs"
              columns={columns}
              rows={runs}
              rowKey={(row) => row.id}
              state={runsQuery.isPending ? 'loading' : 'ready'}
              emptySlot={
                <EmptyState
                  title="No automation runs yet"
                  description="Ask the AI Copilot to file a prepared return, or use “Run in browser” on a filing's guided filing card."
                />
              }
            />
          </>
        )}
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-2xs text-[var(--fd-text-tertiary)]">
        <Bot size={12} aria-hidden="true" />
        OTP, CAPTCHA, portal passwords, and final FILE confirmations are always completed by a
        human in the live browser feed — the agent never types them.
      </p>
    </>
  );
}
