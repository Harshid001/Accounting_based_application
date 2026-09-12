import { Link } from 'react-router-dom';

import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { TASK_STATUS_LABELS } from '@/lib/constants';
import { formatNumber } from '@/lib/format';
import { TASK_STATUSES } from '@/types/enums';
import type { DashboardSummary } from '@/types/models';
import { useLanguage } from '@/context/LanguageContext';

export interface TaskBreakdownProps {
  summary: DashboardSummary | undefined;
  loading: boolean;
}

export function TaskBreakdown({ summary, loading }: TaskBreakdownProps) {
  const { t } = useLanguage();
  const counts = summary?.tasksByStatus ?? {};
  const total = TASK_STATUSES.reduce((sum, status) => sum + (counts[status] ?? 0), 0);

  return (
    <Card>
      <CardHeader 
        title={t('dashboard.tasks.title', 'Tasks by state')} 
        description={t('dashboard.tasks.desc', 'Everything on your plate, grouped.')} 
      />

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-14" rounded="lg" />
          ))}
        </div>
      ) : total === 0 ? (
        <EmptyState
          title={t('dashboard.tasks.emptyTitle', 'No tasks yet')}
          description={t('dashboard.tasks.emptyDesc', 'Tasks you create or are assigned appear here, grouped by state.')}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {TASK_STATUSES.map((status) => (
            <Link
              key={status}
              to={`/tasks?status=${status}`}
              className="rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] px-3 py-2 transition-colors hover:border-[var(--fd-border-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]"
            >
              <span className="block text-xs text-[var(--fd-text-secondary)]">
                {t(`task.status.${status}`, TASK_STATUS_LABELS[status])}
              </span>
              <span className="numeric block text-2xl font-semibold text-[var(--fd-text-primary)]">
                {formatNumber(counts[status] ?? 0)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
