import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/format';
import type { DashboardSummary } from '@/types/models';
import { useLanguage } from '@/context/LanguageContext';

export interface WorkloadPanelProps {
  summary: DashboardSummary | undefined;
  loading: boolean;
}

export function WorkloadPanel({ summary, loading }: WorkloadPanelProps) {
  const { t } = useLanguage();
  const rows = summary?.workload ?? [];
  const peak = rows.reduce((max, row) => Math.max(max, row.openItems), 0);

  return (
    <Card>
      <CardHeader
        title={t('dashboard.workload.title', 'Who is carrying what')}
        description={t('dashboard.workload.desc', 'Open tasks plus open filings, per person.')}
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-1.5 w-full" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={t('dashboard.workload.emptyTitle', 'No workload to show')}
          description={t('dashboard.workload.emptyDesc', 'Once work is assigned, each person\'s open item count appears here.')}
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.staffId} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-base text-[var(--fd-text-primary)]">
                  {row.staffName}
                </span>
                <span className="numeric text-xs text-[var(--fd-text-tertiary)]">
                  {formatNumber(row.openItems)} {t('dashboard.workload.open', 'open')}
                </span>
              </div>
              <ProgressBar
                value={row.openItems}
                max={Math.max(peak, 1)}
                label={`${row.staffName} ${t('dashboard.workload.hasOpen', 'has {count} open items').replace('{count}', String(row.openItems))}`}
                tone={row.openItems === peak && peak > 0 ? 'waiting' : 'accent'}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
