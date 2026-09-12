import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { listClients } from '@/api/clients.api';
import { setUserLinkedClients } from '@/api/users.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/context/ToastContext';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';
import type { NamedRef } from '@/types/models';

export interface LinkedClientsEditorProps {
  userId: string;
  linked: readonly NamedRef[];
  emailVerified?: boolean;
}

export function LinkedClientsEditor({
  userId,
  linked,
  emailVerified = true,
}: LinkedClientsEditorProps) {
  const queryClient = useQueryClient();
  const { success, errorToast } = useToast();
  const [selected, setSelected] = useState<string[]>(linked.map((client) => client.id));
  const [term, setTerm] = useState('');
  const debounced = useDebounce(term, SEARCH_DEBOUNCE_MS);

  const linkedKey = linked.map((client) => client.id).join('|');
  const [lastLinkedKey, setLastLinkedKey] = useState(linkedKey);
  if (lastLinkedKey !== linkedKey) {
    setLastLinkedKey(linkedKey);
    setSelected(linked.map((client) => client.id));
  }

  const params = { page: 1, limit: 50, ...(debounced.trim().length > 0 ? { q: debounced } : {}) };
  const clients = useQuery({
    queryKey: queryKeys.clients.list(params),
    queryFn: ({ signal }) => listClients(params, signal),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (clientIds: string[]) => setUserLinkedClients(userId, clientIds),
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      success(
        'Links saved',
        user.linkedClients.length === 0
          ? 'This account is unlinked and can see nothing.'
          : `Linked to ${user.linkedClients.length} client record${user.linkedClients.length === 1 ? '' : 's'}.`,
      );
    },
    onError: (error: unknown) => {
      errorToast(error, 'Those links did not save');
    },
  });

  const dirty =
    selected.length !== linked.length ||
    selected.some((id) => !linked.some((client) => client.id === id));

  return (
    <Card>
      <CardHeader
        title="Linked client records"
        description="A client account sees exactly these records and nothing else."
        actions={
          <Button
            variant="primary"
            size="sm"
            disabled={!dirty || !emailVerified}
            loading={mutation.isPending}
            loadingLabel="Saving links"
            title={
              !emailVerified
                ? 'Only verified accounts can be linked to client records.'
                : undefined
            }
            onClick={() => {
              mutation.mutate(selected);
            }}
          >
            Save links
          </Button>
        }
      />

      <div className="space-y-3">
        {!emailVerified ? (
          <div className="rounded-md border border-[var(--fd-border-warning)] bg-[var(--fd-surface-warning)] p-3 text-xs text-[var(--fd-text-warning)]">
            <span className="font-semibold">Security Requirement:</span> This account has not
            verified their email address yet. Only verified accounts can be linked to client
            records to prevent account squatting.
          </div>
        ) : null}
        <Input
          type="search"
          value={term}
          aria-label="Search clients to link"
          placeholder="Search clients to link"
          onChange={(event) => {
            setTerm(event.target.value);
          }}
        />

        {clients.isPending ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : (clients.data?.items.length ?? 0) === 0 ? (
          <p className="text-xs text-[var(--fd-text-tertiary)]">
            No client matches that search.
          </p>
        ) : (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {(clients.data?.items ?? []).map((client) => (
              <li key={client.id}>
                <Checkbox
                  checked={selected.includes(client.id)}
                  label={client.displayName}
                  description={client.pan ?? client.gstin ?? undefined}
                  onCheckedChange={(checked) => {
                    setSelected((current) =>
                      checked
                        ? [...new Set([...current, client.id])]
                        : current.filter((id) => id !== client.id),
                    );
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        {selected.length === 0 ? (
          <p className="text-xs text-[var(--fd-status-waiting)]">
            With nothing selected this account lands on the unlinked screen every time it signs in.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
