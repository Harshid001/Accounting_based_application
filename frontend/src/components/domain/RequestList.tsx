import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, BellRing, MoreVertical } from 'lucide-react';
import type { ReactNode } from 'react';

import { cancelDocumentRequest, remindDocumentRequest } from '@/api/documentRequests.api';
import { queryKeys } from '@/api/queryKeys';
import { DataTable } from '@/components/ui/table';
import type { TableColumn } from '@/components/ui/table';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import type { MenuAction } from '@/components/ui/dropdown-menu';
import { IconButton } from '@/components/ui/icon-button';
import { OverdueBadge, RequestStatusPill } from '@/components/domain/StatusPills';
import { DOCUMENT_TYPE_LABELS } from '@/lib/constants';
import { formatDate, relativeTime } from '@/lib/date';
import { pluralise } from '@/lib/format';
import { useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import type { DocumentRequestView } from '@/types/models';

export interface RequestListProps {
  requests: readonly DocumentRequestView[];
  loading: boolean;
  emptySlot: ReactNode;
  showClient?: boolean;
}

export function RequestList({ requests, loading, emptySlot, showClient = false }: RequestListProps) {
  const queryClient = useQueryClient();
  const { allows } = useSession();
  const { success, errorToast } = useToast();

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.documentRequests.all });
  };

  const remind = useMutation({
    mutationFn: remindDocumentRequest,
    onSuccess: (result) => {
      invalidate();
      success(
        'Reminder sent',
        result.sent === 0
          ? 'No linked client contact could be emailed.'
          : `Emailed ${pluralise(result.sent, 'contact')}.`,
      );
    },
    onError: (error: unknown) => {
      errorToast(error, 'That reminder was not sent');
    },
  });

  const cancel = useMutation({
    mutationFn: cancelDocumentRequest,
    onSuccess: () => {
      invalidate();
      success('Request cancelled');
    },
    onError: (error: unknown) => {
      errorToast(error, 'That request was not cancelled');
    },
  });

  const actionsFor = (request: DocumentRequestView): MenuAction[] => {
    const actions: MenuAction[] = [];
    if (request.status === 'open' && allows('document_request:remind')) {
      actions.push({
        id: 'remind',
        label: 'Send a reminder',
        icon: <BellRing size={14} aria-hidden="true" />,
        onSelect: () => {
          remind.mutate(request.id);
        },
      });
    }
    if (request.status === 'open' && allows('document_request:write')) {
      actions.push({
        id: 'cancel',
        label: 'Cancel this request',
        icon: <Ban size={14} aria-hidden="true" />,
        danger: true,
        separatorBefore: actions.length > 0,
        onSelect: () => {
          cancel.mutate(request.id);
        },
      });
    }
    return actions;
  };

  const columns: Array<TableColumn<DocumentRequestView>> = [
    {
      id: 'title',
      header: 'Asked for',
      cell: (row) => (
        <span className="min-w-0">
          <span className="block font-medium text-[var(--fd-text-primary)]">{row.title}</span>
          {row.description === null ? null : (
            <span className="text-2xs block truncate text-[var(--fd-text-tertiary)]">
              {row.description}
            </span>
          )}
        </span>
      ),
    },
    ...(showClient
      ? [
          {
            id: 'client',
            header: 'Client',
            hideBelow: 'lg' as const,
            cell: (row: DocumentRequestView) => row.client?.name ?? '—',
          },
        ]
      : []),
    {
      id: 'type',
      header: 'Type',
      hideBelow: 'md',
      cell: (row) => (
        <span className="text-[var(--fd-text-secondary)]">
          {DOCUMENT_TYPE_LABELS[row.documentType]}
        </span>
      ),
    },
    {
      id: 'due',
      header: 'Due',
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="numeric">{formatDate(row.dueDate)}</span>
          <OverdueBadge overdue={row.isOverdue} />
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <span className="flex flex-col gap-1">
          <RequestStatusPill status={row.status} />
          {row.lastRemindedAt === null ? null : (
            <span className="text-2xs text-[var(--fd-text-tertiary)]">
              Chased {relativeTime(row.lastRemindedAt)}
            </span>
          )}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      caption="Document requests"
      columns={columns}
      rows={requests}
      rowKey={(row) => row.id}
      state={loading ? 'loading' : 'ready'}
      emptySlot={emptySlot}
      rowActions={(row) => {
        const actions = actionsFor(row);
        if (actions.length === 0) return null;
        return (
          <DropdownMenu
            ariaLabel={`Actions for ${row.title}`}
            actions={actions}
            trigger={
              <IconButton
                label={`Actions for ${row.title}`}
                size="sm"
                icon={<MoreVertical size={15} aria-hidden="true" />}
              />
            }
          />
        );
      }}
    />
  );
}
