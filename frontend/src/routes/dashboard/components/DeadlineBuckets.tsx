import { Link } from 'react-router-dom';

import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { addDaysDateOnly, todayDateOnly } from '@/lib/date';
import { formatNumber } from '@/lib/format';
import type { DashboardSummary } from '@/types/models';

export interface DeadlineBucketsProps {
  summary: DashboardSummary | undefined;
  loading: boolean;
}

export function DeadlineBuckets({ summary, loading }: DeadlineBucketsProps) {
  const today = todayDateOnly();
  const buckets = [
    { label: 'Due within 7 days', days: 7, value: summary?.dueIn7 },
    { label: 'Due within 14 days', days: 14, value: summary?.dueIn14 },
    { label: 'Due within 30 days', days: 30, value: summary?.dueIn30 },
  ];

  return (
    <Card>
      <CardHeader title="What is coming up" description="Filings not yet filed, by window." />
      <ul className="divide-y divide-[var(--fd-border-subtle)]">
        {buckets.map((bucket) => (
          <li key={bucket.days}>
            <Link
              to={`/compliance?dueFrom=${today}&dueTo=${addDaysDateOnly(today, bucket.days)}`}
              className="flex items-center justify-between gap-3 rounded-md px-1 py-2.5 transition-colors hover:bg-[var(--fd-surface-3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]"
            >
              <span className="text-base text-[var(--fd-text-secondary)]">{bucket.label}</span>
              {loading ? (
                <Skeleton className="h-5 w-8" />
              ) : (
                <span className="numeric text-xl font-semibold text-[var(--fd-text-primary)]">
                  {formatNumber(bucket.value ?? 0)}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
