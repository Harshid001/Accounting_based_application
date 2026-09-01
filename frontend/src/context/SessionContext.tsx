import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo } from 'react';

import { fetchSession } from '@/api/me.api';
import type { SessionResult } from '@/api/me.api';
import { queryKeys } from '@/api/queryKeys';
import type { Capability } from '@/lib/permissions';
import { can } from '@/lib/permissions';
import type { Me } from '@/types/models';

export type SessionStatus = 'loading' | 'anonymous' | 'unverified' | 'authenticated' | 'error';

interface SessionContextValue {
  status: SessionStatus;
  user: Me | null;
  pendingVerification: { email: string; name: string } | null;
  error: unknown;
  refresh: () => Promise<void>;
  clear: () => void;
  allows: (capability: Capability) => boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const query = useQuery<SessionResult>({
    queryKey: queryKeys.me,
    queryFn: fetchSession,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.me });
  }, [queryClient]);

  const clear = useCallback(() => {
    queryClient.setQueryData<SessionResult>(queryKeys.me, { kind: 'anonymous' });
    queryClient.removeQueries({ predicate: (item) => item.queryKey[0] !== 'me' });
  }, [queryClient]);

  const value = useMemo<SessionContextValue>(() => {
    const result = query.data;
    const status: SessionStatus = query.isPending
      ? 'loading'
      : query.isError
        ? 'error'
        : result === undefined
          ? 'loading'
          : result.kind === 'authenticated'
            ? 'authenticated'
            : result.kind === 'unverified'
              ? 'unverified'
              : 'anonymous';

    const user = result?.kind === 'authenticated' ? result.user : null;
    const pendingVerification =
      result?.kind === 'unverified' ? { email: result.email, name: result.name } : null;

    return {
      status,
      user,
      pendingVerification,
      error: query.error,
      refresh,
      clear,
      allows: (capability: Capability) => can(user, capability),
    };
  }, [query.data, query.isPending, query.isError, query.error, refresh, clear]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) throw new Error('useSession must be used inside SessionProvider.');
  return value;
}

export function useCurrentUser(): Me {
  const { user } = useSession();
  if (user === null) throw new Error('This screen requires a signed-in user.');
  return user;
}
