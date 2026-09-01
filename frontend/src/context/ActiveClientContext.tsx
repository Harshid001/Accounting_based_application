import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { setActiveClientHeader } from '@/api/client';
import { listPortalClients } from '@/api/portal.api';
import { queryKeys } from '@/api/queryKeys';
import { ACTIVE_CLIENT_STORAGE_PREFIX } from '@/lib/constants';
import { useSession } from '@/context/SessionContext';
import type { PortalClientOption } from '@/types/models';

interface ActiveClientContextValue {
  clients: PortalClientOption[];
  activeClientId: string | null;
  activeClient: PortalClientOption | null;
  setActiveClientId: (id: string) => void;
  showSwitcher: boolean;
  loading: boolean;
  error: unknown;
  retry: () => void;
}

const ActiveClientContext = createContext<ActiveClientContextValue | null>(null);

const storageKey = (userId: string): string => `${ACTIVE_CLIENT_STORAGE_PREFIX}.${userId}`;

const readStored = (userId: string): string | null => {
  try {
    return window.localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
};

const writeStored = (userId: string, clientId: string): void => {
  try {
    window.localStorage.setItem(storageKey(userId), clientId);
  } catch {
    setActiveClientHeader(clientId);
  }
};

export function ActiveClientProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const isClientAccount = user?.role === 'client' && user.linkedClients.length > 0;
  const [selected, setSelected] = useState<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.portal.clients,
    queryFn: listPortalClients,
    enabled: isClientAccount,
    staleTime: 5 * 60_000,
  });

  const clients = useMemo(() => query.data ?? [], [query.data]);

  const resolved = useMemo<string | null>(() => {
    if (!isClientAccount || user === null || clients.length === 0) return null;
    if (selected !== null && clients.some((client) => client.id === selected)) return selected;
    const stored = readStored(user.id);
    if (stored !== null && clients.some((client) => client.id === stored)) return stored;
    return clients[0]?.id ?? null;
  }, [clients, isClientAccount, selected, user]);

  useEffect(() => {
    setActiveClientHeader(resolved);
  }, [resolved]);

  const setActiveClientId = useCallback(
    (id: string) => {
      if (user === null) return;
      setSelected(id);
      setActiveClientHeader(id);
      writeStored(user.id, id);
      queryClient.removeQueries({ queryKey: queryKeys.portal.all });
      queryClient.removeQueries({ queryKey: queryKeys.documents.all });
      queryClient.removeQueries({ queryKey: queryKeys.messages.all });
    },
    [queryClient, user],
  );

  const retry = useCallback(() => {
    void query.refetch();
  }, [query]);

  const value = useMemo<ActiveClientContextValue>(
    () => ({
      clients,
      activeClientId: resolved,
      activeClient: clients.find((client) => client.id === resolved) ?? null,
      setActiveClientId,
      showSwitcher: clients.length > 1,
      loading: isClientAccount && query.isPending,
      error: query.error,
      retry,
    }),
    [clients, resolved, setActiveClientId, isClientAccount, query.isPending, query.error, retry],
  );

  return <ActiveClientContext.Provider value={value}>{children}</ActiveClientContext.Provider>;
}

export function useActiveClient(): ActiveClientContextValue {
  const value = useContext(ActiveClientContext);
  if (value === null) throw new Error('useActiveClient must be used inside ActiveClientProvider.');
  return value;
}
