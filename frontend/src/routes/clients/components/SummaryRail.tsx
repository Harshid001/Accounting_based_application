import { Link } from 'react-router-dom';

import { AvatarGroup } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ClientStatusPill } from '@/components/domain/StatusPills';
import { CLIENT_TYPE_LABELS } from '@/lib/constants';
import { formatDate, isPastDateOnly } from '@/lib/date';
import type { ClientDetail } from '@/types/models';

export interface SummaryRailProps {
  client: ClientDetail;
  nextDueDate: string | null;
  openRequests: number;
  unreadMessages: number;
}

export function SummaryRail({
  client,
  nextDueDate,
  openRequests,
  unreadMessages,
}: SummaryRailProps) {
  const items: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'Status', value: <ClientStatusPill status={client.status} /> },
    {
      label: 'Type',
      value: (
        <span className="text-base text-[var(--fd-text-primary)]">
          {CLIENT_TYPE_LABELS[client.clientType]}
        </span>
      ),
    },
    {
      label: 'Assigned staff',
      value: <AvatarGroup names={client.assignedStaff.map((person) => person.name)} />,
    },
    {
      label: 'Next deadline',
      value: (
        <span
          className={
            isPastDateOnly(nextDueDate)
              ? 'numeric text-base text-[var(--fd-status-danger)]'
              : 'numeric text-base text-[var(--fd-text-primary)]'
          }
        >
          {formatDate(nextDueDate, 'None scheduled')}
        </span>
      ),
    },
    {
      label: 'Open requests',
      value: (
        <Link
          to={`/clients/${client.id}/requests`}
          className="numeric rounded-sm text-base text-[var(--fd-accent)] hover:underline"
        >
          {openRequests}
        </Link>
      ),
    },
    {
      label: 'Unread messages',
      value: (
        <Link
          to={`/clients/${client.id}/messages`}
          className="numeric rounded-sm text-base text-[var(--fd-accent)] hover:underline"
        >
          {unreadMessages}
        </Link>
      ),
    },
  ];

  return (
    <Card className="xl:sticky xl:top-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 truncate text-lg font-semibold text-[var(--fd-text-primary)]">
          At a glance
        </h2>
        {client.archived ? <Badge tone="muted">Archived</Badge> : null}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 xl:grid-cols-1">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-2xs tracking-wide text-[var(--fd-text-tertiary)] uppercase">
              {item.label}
            </dt>
            <dd className="mt-0.5">{item.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
