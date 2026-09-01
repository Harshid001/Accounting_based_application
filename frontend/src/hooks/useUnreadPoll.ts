import { useQuery } from '@tanstack/react-query';

import { fetchUnreadCounts } from '@/api/notifications.api';
import { queryKeys } from '@/api/queryKeys';
import { UNREAD_POLL_MS } from '@/lib/constants';
import type { UnreadCounts } from '@/types/models';

export interface UnreadPoll {
  counts: UnreadCounts;
  isLoading: boolean;
}

export function useUnreadPoll(enabled: boolean): UnreadPoll {
  const query = useQuery({
    queryKey: queryKeys.notifications.unread,
    queryFn: ({ signal }) => fetchUnreadCounts(signal),
    enabled,
    refetchInterval: enabled ? UNREAD_POLL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: UNREAD_POLL_MS / 2,
    retry: 1,
  });

  return {
    counts: query.data ?? { notifications: 0, messages: 0 },
    isLoading: query.isPending && enabled,
  };
}
