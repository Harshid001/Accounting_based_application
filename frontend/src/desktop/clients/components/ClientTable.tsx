import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pin, PinOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { pinClient, unpinClient } from '@/api/clients.api';
import { queryKeys } from '@/api/queryKeys';
import { AvatarGroup } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/table';
import type { TableColumn } from '@/components/ui/table';
import { IconButton } from '@/components/ui/icon-button';
import { ClientStatusPill } from '@/components/domain/StatusPills';
import { CLIENT_TYPE_LABELS } from '@/lib/constants';
import { formatDate, isPastDateOnly } from '@/lib/date';
import { useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import type { ClientListRow } from '@/types/models';

export interface ClientTableProps {
  clients: readonly ClientListRow[];
  loading: boolean;
  emptySlot: ReactNode;
  sort: { field: string; direction: 'asc' | 'desc' } | null;
  onSortChange: (field: string) => void;
}

export function ClientTable({
  clients,
  loading,
  emptySlot,
  sort,
  onSortChange,
}: ClientTableProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { allows } = useSession();
  const { errorToast } = useToast();

  const pin = useMutation({
    mutationFn: async (input: { id: string; pinned: boolean }) =>
      input.pinned ? unpinClient(input.id) : pinClient(input.id),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.clients.all });
      const snapshot = queryClient.getQueriesData({ queryKey: queryKeys.clients.all });
      queryClient.setQueriesData<{ items: ClientListRow[] }>(
        { queryKey: queryKeys.clients.all },
        (current) =>
          current === undefined
            ? current
            : {
                ...current,
                items: current.items.map((row) =>
                  row.id === input.id ? { ...row, pinned: !input.pinned } : row,
                ),
              },
      );
      return { snapshot };
    },
    onError: (error: unknown, _input, context) => {
      for (const [key, value] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, value);
      }
      errorToast(error, 'That pin did not save');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });

  const columns: Array<TableColumn<ClientListRow>> = [
    {
      id: 'name',
      header: 'Client',
      sortField: 'displayName',
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-2">
          {row.pinned ? (
            <Pin size={12} aria-label="Pinned" className="shrink-0 text-[var(--fd-accent)]" />
          ) : null}
          <Link
            to={`/clients/${row.id}/profile`}
            className="min-w-0 truncate rounded-sm font-medium text-[var(--fd-text-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]"
          >
            {row.displayName}
          </Link>
          {row.archived ? <Badge tone="muted">Archived</Badge> : null}
        </span>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      hideBelow: 'lg',
      cell: (row) => (
        <span className="text-[var(--fd-text-secondary)]">{CLIENT_TYPE_LABELS[row.clientType]}</span>
      ),
    },
    {
      id: 'identifier',
      header: 'PAN / GSTIN',
      hideBelow: 'lg',
      cell: (row) => (
        <span className="numeric text-[var(--fd-text-secondary)]">
          {row.pan ?? row.gstin ?? '—'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortField: 'status',
      cell: (row) => <ClientStatusPill status={row.status} />,
    },
    {
      id: 'staff',
      header: 'Assigned',
      hideBelow: 'md',
      cell: (row) => <AvatarGroup names={row.assignedStaff.map((person) => person.name)} />,
    },
    {
      id: 'due',
      header: 'Next deadline',
      align: 'right',
      cell: (row) => (
        <span
          className={
            isPastDateOnly(row.nextDueDate)
              ? 'numeric text-[var(--fd-status-danger)]'
              : 'numeric text-[var(--fd-text-secondary)]'
          }
        >
          {formatDate(row.nextDueDate, 'None')}
        </span>
      ),
    },
    {
      id: 'open',
      header: 'Open asks',
      align: 'right',
      hideBelow: 'lg',
      cell: (row) => (
        <span className="numeric text-[var(--fd-text-secondary)]">
          {row.openRequestCount}
          {row.unreadMessageCount > 0 ? ` · ${row.unreadMessageCount} unread` : ''}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      caption="Clients"
      columns={columns}
      rows={clients}
      rowKey={(row) => row.id}
      state={loading ? 'loading' : 'ready'}
      emptySlot={emptySlot}
      sort={sort}
      onSortChange={onSortChange}
      onRowClick={(row) => {
        void navigate(`/clients/${row.id}/profile`);
      }}
      rowActions={
        allows('client:pin')
          ? (row) => (
              <IconButton
                label={row.pinned ? `Unpin ${row.displayName}` : `Pin ${row.displayName}`}
                size="sm"
                icon={
                  row.pinned ? (
                    <PinOff size={14} aria-hidden="true" />
                  ) : (
                    <Pin size={14} aria-hidden="true" />
                  )
                }
                onClick={() => {
                  pin.mutate({ id: row.id, pinned: row.pinned });
                }}
              />
            )
          : undefined
      }
    />
  );
}
