import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';

import { listMySessions, revokeOtherSessions } from '@/api/me.api';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/context/ToastContext';
import { formatDateTime } from '@/lib/date';
import { truncate } from '@/lib/format';

export function SessionsPanel() {
  const queryClient = useQueryClient();
  const { success, errorToast } = useToast();
  const confirm = useConfirm();

  const query = useQuery({
    queryKey: queryKeys.mySessions,
    queryFn: listMySessions,
    staleTime: 30_000,
  });

  const revoke = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.mySessions });
      success('Signed out everywhere else', 'Only this device is still signed in.');
    },
    onError: (error: unknown) => {
      errorToast(error, 'Those sessions were not ended');
    },
  });

  const sessions = query.data ?? [];
  const others = sessions.filter((session) => !session.current).length;

  return (
    <Card>
      <CardHeader
        title="Signed-in devices"
        description="Sessions slide as you use FirmDesk. Ending them takes effect immediately."
        actions={
          <Button
            variant="secondary"
            size="sm"
            disabled={others === 0}
            iconLeft={<LogOut size={14} aria-hidden="true" />}
            onClick={() => {
              confirm.ask({
                title: 'Sign out of all other devices?',
                body: 'Every session except this one ends straight away. Anyone using them will have to sign in again.',
                confirmLabel: 'Sign out other devices',
                destructive: true,
                onConfirm: async () => {
                  await revoke.mutateAsync().catch(() => undefined);
                },
              });
            }}
          >
            Sign out other devices
          </Button>
        }
      />

      {query.isError ? (
        <ErrorState
          compact
          error={query.error}
          title="Sessions did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : query.isPending ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-12 w-full" rounded="lg" />
          <Skeleton className="h-12 w-full" rounded="lg" />
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No sessions listed"
          description="This is unusual — refresh the page, and sign in again if it stays empty."
        />
      ) : (
        <ul className="divide-y divide-[var(--fd-border-subtle)]">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-base text-[var(--fd-text-primary)]">
                  {truncate(session.userAgent ?? 'Unknown device', 60)}
                  {session.current ? <Badge tone="accent">This device</Badge> : null}
                </p>
                <p className="text-2xs numeric text-[var(--fd-text-tertiary)]">
                  {session.ipAddress ?? 'IP unknown'} · started{' '}
                  {formatDateTime(session.createdAt)} · expires {formatDateTime(session.expiresAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirm.request === null ? null : (
        <ConfirmDialog
          open={confirm.open}
          onOpenChange={confirm.setOpen}
          title={confirm.request.title}
          body={confirm.request.body}
          confirmLabel={confirm.request.confirmLabel}
          destructive={confirm.request.destructive ?? false}
          pending={confirm.pending}
          onConfirm={confirm.confirm}
        />
      )}
    </Card>
  );
}
