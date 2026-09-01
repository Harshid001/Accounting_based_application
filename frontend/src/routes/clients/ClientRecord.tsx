import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Pencil } from 'lucide-react';
import { createContext, useContext } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';

import {
  archiveClient,
  getClient,
  listClients,
  restoreClient,
} from '@/api/clients.api';
import { queryKeys } from '@/api/queryKeys';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { RoutedTabs } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { SummaryRail } from '@/routes/clients/components/SummaryRail';
import { useConfirm } from '@/hooks/useConfirm';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import type { ClientDetail } from '@/types/models';

interface ClientRecordContextValue {
  client: ClientDetail;
  clientId: string;
  readOnly: boolean;
}

const ClientRecordContext = createContext<ClientRecordContextValue | null>(null);

export function useClientRecord(): ClientRecordContextValue {
  const value = useContext(ClientRecordContext);
  if (value === null) throw new Error('This tab must render inside the client record.');
  return value;
}

export function ClientRecord() {
  const { clientId = '' } = useParams();
  const queryClient = useQueryClient();
  const { allows } = useSession();
  const { success, errorToast } = useToast();
  const confirm = useConfirm();

  const detail = useQuery({
    queryKey: queryKeys.clients.detail(clientId),
    queryFn: () => getClient(clientId),
    enabled: clientId.length > 0,
  });

  const summaryParams = { page: 1, limit: 1, q: detail.data?.displayName ?? '' };
  const summary = useQuery({
    queryKey: queryKeys.clients.list(summaryParams),
    queryFn: ({ signal }) => listClients(summaryParams, signal),
    enabled: detail.data !== undefined,
    staleTime: 30_000,
  });

  usePageTitle(detail.data?.displayName ?? 'Client');

  const archive = useMutation({
    mutationFn: async (archived: boolean) =>
      archived ? restoreClient(clientId) : archiveClient(clientId),
    onSuccess: (_client, archived) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      success(
        archived ? 'Client restored' : 'Client archived',
        archived
          ? 'It is back in the default lists and editable again.'
          : 'It is hidden from default lists and read-only until restored.',
      );
    },
    onError: (error: unknown) => {
      errorToast(error, 'That change did not save');
    },
  });

  if (detail.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" rounded="lg" />
      </div>
    );
  }

  if (detail.isError) {
    return (
      <ErrorState
        error={detail.error}
        title="That client did not load"
        onRetry={() => {
          void detail.refetch();
        }}
      />
    );
  }

  const client = detail.data;
  const row = summary.data?.items.find((entry) => entry.id === clientId) ?? null;

  return (
    <ClientRecordContext.Provider value={{ client, clientId, readOnly: client.archived }}>
      <PageHeader
        breadcrumb={
          <Breadcrumb
            items={[{ label: 'Clients', to: '/clients' }, { label: client.displayName }]}
          />
        }
        title={client.displayName}
        {...(client.legalName === null ? {} : { description: client.legalName })}
        actions={
          <>
            {allows('client:update') && !client.archived ? (
              <Button asChild variant="secondary" size="sm">
                <Link to={`/clients/${clientId}/edit`}>
                  <Pencil size={14} aria-hidden="true" />
                  Edit
                </Link>
              </Button>
            ) : null}
            {allows('client:archive') ? (
              <Button
                variant={client.archived ? 'secondary' : 'danger'}
                size="sm"
                iconLeft={
                  client.archived ? (
                    <ArchiveRestore size={14} aria-hidden="true" />
                  ) : (
                    <Archive size={14} aria-hidden="true" />
                  )
                }
                onClick={() => {
                  confirm.ask({
                    title: client.archived
                      ? `Restore ${client.displayName}?`
                      : `Archive ${client.displayName}?`,
                    body: client.archived
                      ? 'It returns to the default client list and becomes editable again.'
                      : 'It disappears from every default list and becomes read-only. You can restore it at any time.',
                    confirmLabel: client.archived ? 'Restore client' : 'Archive client',
                    destructive: !client.archived,
                    onConfirm: async () => {
                      await archive.mutateAsync(client.archived).catch(() => undefined);
                    },
                  });
                }}
              >
                {client.archived ? 'Restore' : 'Archive'}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 xl:order-1">
          <RoutedTabs
            ariaLabel="Client record"
            tabs={[
              { to: 'profile', label: 'Profile' },
              { to: 'documents', label: 'Documents' },
              { to: 'compliance', label: 'Compliance' },
              { to: 'tasks', label: 'Tasks' },
              {
                to: 'requests',
                label: 'Requests',
                ...(row === null ? {} : { badge: row.openRequestCount }),
              },
              {
                to: 'messages',
                label: 'Messages',
                ...(row === null ? {} : { badge: row.unreadMessageCount }),
              },
              { to: 'activity', label: 'Activity' },
            ]}
          />
          <div className="pt-4">
            <Outlet />
          </div>
        </div>

        <div className="xl:order-2">
          <SummaryRail
            client={client}
            nextDueDate={row?.nextDueDate ?? null}
            openRequests={row?.openRequestCount ?? 0}
            unreadMessages={row?.unreadMessageCount ?? 0}
          />
        </div>
      </div>

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
    </ClientRecordContext.Provider>
  );
}
