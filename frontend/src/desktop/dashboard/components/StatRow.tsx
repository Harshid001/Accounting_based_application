import { AlertTriangle, Building2, Clock, Inbox } from 'lucide-react';

import { StatTile } from '@/components/ui/stat-tile';
import type { DashboardSummary } from '@/types/models';
import { useLanguage } from '@/context/LanguageContext';

export interface StatRowProps {
  summary: DashboardSummary | undefined;
  loading: boolean;
}

export function StatRow({ summary, loading }: StatRowProps) {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      <StatTile
        label={t('dashboard.stats.clients', 'Clients')}
        value={summary?.clientCount ?? null}
        loading={loading}
        to="/clients"
        icon={<Building2 size={15} aria-hidden="true" />}
      />
      <StatTile
        label={t('dashboard.stats.overdue', 'Overdue filings')}
        value={summary?.overdueFilings ?? null}
        tone={(summary?.overdueFilings ?? 0) > 0 ? 'danger' : 'default'}
        loading={loading}
        to="/compliance?overdue=true"
        icon={<AlertTriangle size={15} aria-hidden="true" />}
      />
      <StatTile
        label={t('dashboard.stats.awaiting', 'Awaiting client')}
        value={summary?.awaitingClient ?? null}
        tone={(summary?.awaitingClient ?? 0) > 0 ? 'waiting' : 'default'}
        loading={loading}
        to="/compliance?status=awaiting_client"
        icon={<Clock size={15} aria-hidden="true" />}
      />
      <StatTile
        label={t('dashboard.stats.openRequests', 'Open requests')}
        value={summary?.openRequests ?? null}
        loading={loading}
        to="/requests?status=open"
        icon={<Inbox size={15} aria-hidden="true" />}
      />
    </div>
  );
}
