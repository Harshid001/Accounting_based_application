import { AlertTriangle, Building2, Clock, Inbox } from 'lucide-react';

import { StatTile } from '@/components/ui/stat-tile';
import type { DashboardSummary } from '@/types/models';

export interface StatRowProps {
  summary: DashboardSummary | undefined;
  loading: boolean;
}

export function StatRow({ summary, loading }: StatRowProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label="Clients"
        value={summary?.clientCount ?? null}
        loading={loading}
        to="/clients"
        icon={<Building2 size={15} aria-hidden="true" />}
      />
      <StatTile
        label="Overdue filings"
        value={summary?.overdueFilings ?? null}
        tone={(summary?.overdueFilings ?? 0) > 0 ? 'danger' : 'default'}
        loading={loading}
        to="/compliance?overdue=true"
        icon={<AlertTriangle size={15} aria-hidden="true" />}
      />
      <StatTile
        label="Awaiting client"
        value={summary?.awaitingClient ?? null}
        tone={(summary?.awaitingClient ?? 0) > 0 ? 'waiting' : 'default'}
        loading={loading}
        to="/compliance?status=awaiting_client"
        icon={<Clock size={15} aria-hidden="true" />}
      />
      <StatTile
        label="Open requests"
        value={summary?.openRequests ?? null}
        loading={loading}
        to="/requests?status=open"
        icon={<Inbox size={15} aria-hidden="true" />}
      />
    </div>
  );
}
