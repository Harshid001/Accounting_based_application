import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { IconButton } from '@/components/ui/icon-button';
import { useUnreadPoll } from '@/hooks/useUnreadPoll';
import { formatNumber } from '@/lib/format';

export interface NotificationBellProps {
  enabled: boolean;
  to?: string;
}

export function NotificationBell({ enabled, to = '/notifications' }: NotificationBellProps) {
  const navigate = useNavigate();
  const { counts } = useUnreadPoll(enabled);
  const total = counts.notifications + counts.messages;
  const label =
    total === 0
      ? 'Notifications, none unread'
      : `Notifications, ${formatNumber(total)} unread`;

  return (
    <span className="relative inline-flex">
      <IconButton
        label={label}
        icon={<Bell size={16} aria-hidden="true" />}
        onClick={() => {
          void navigate(to);
        }}
      />
      {total > 0 ? (
        <span
          aria-hidden="true"
          className="numeric absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-[var(--fd-status-danger)] px-1 text-center text-[10px] leading-4 font-semibold text-[var(--fd-accent-contrast)]"
        >
          {total > 99 ? '99+' : total}
        </span>
      ) : null}
    </span>
  );
}
