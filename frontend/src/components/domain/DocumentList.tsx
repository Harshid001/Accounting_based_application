import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Download, FileText, History, MoreVertical, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  archiveDocument,
  hardDeleteDocument,
  requestDownload,
  restoreDocument,
} from '@/api/documents.api';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/table';
import type { TableColumn } from '@/components/ui/table';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { IconButton } from '@/components/ui/icon-button';
import type { MenuAction } from '@/components/ui/dropdown-menu';
import { DOCUMENT_TYPE_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/date';
import { formatBytes } from '@/lib/format';
import { openPresignedUrl } from '@/lib/download';
import { useConfirm } from '@/hooks/useConfirm';
import { useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import type { DocumentListRow } from '@/types/models';

export interface DocumentListProps {
  documents: readonly DocumentListRow[];
  loading: boolean;
  emptySlot: ReactNode;
  showClient?: boolean;
  onOpenVersions?: (document: DocumentListRow) => void;
}

export function DocumentList({
  documents,
  loading,
  emptySlot,
  showClient = false,
  onOpenVersions,
}: DocumentListProps) {
  const queryClient = useQueryClient();
  const { allows } = useSession();
  const { success, errorToast } = useToast();
  const confirm = useConfirm();

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
  };

  const download = useMutation({
    mutationFn: async (input: { id: string; version?: number }) =>
      requestDownload(input.id, input.version),
    onSuccess: (ticket) => {
      openPresignedUrl(ticket.url);
    },
    onError: (error: unknown) => {
      errorToast(error, 'That download link could not be created');
    },
  });

  const archive = useMutation({
    mutationFn: async (input: { id: string; archived: boolean }) =>
      input.archived ? restoreDocument(input.id) : archiveDocument(input.id),
    onSuccess: (_data, input) => {
      invalidate();
      success(input.archived ? 'Document restored' : 'Document archived');
    },
    onError: (error: unknown) => {
      errorToast(error, 'That change did not save');
    },
  });

  const remove = useMutation({
    mutationFn: async (input: { id: string; confirm: string }) =>
      hardDeleteDocument(input.id, input.confirm),
    onSuccess: () => {
      invalidate();
      success('Document deleted', 'Every version has been removed from storage.');
    },
    onError: (error: unknown) => {
      errorToast(error, 'That document was not deleted');
    },
  });

  const actionsFor = (document: DocumentListRow): MenuAction[] => {
    const actions: MenuAction[] = [
      {
        id: 'download',
        label: 'Download latest',
        icon: <Download size={14} aria-hidden="true" />,
        onSelect: () => {
          download.mutate({ id: document.id });
        },
      },
    ];

    if (onOpenVersions !== undefined && document.versionCount > 1) {
      actions.push({
        id: 'versions',
        label: `Version history (${document.versionCount})`,
        icon: <History size={14} aria-hidden="true" />,
        onSelect: () => {
          onOpenVersions(document);
        },
      });
    }

    if (allows('document:archive')) {
      actions.push({
        id: 'archive',
        label: document.archived ? 'Restore' : 'Archive',
        icon: document.archived ? (
          <ArchiveRestore size={14} aria-hidden="true" />
        ) : (
          <Archive size={14} aria-hidden="true" />
        ),
        separatorBefore: true,
        onSelect: () => {
          archive.mutate({ id: document.id, archived: document.archived });
        },
      });
    }

    if (allows('document:hard_delete')) {
      actions.push({
        id: 'delete',
        label: 'Delete permanently',
        icon: <Trash2 size={14} aria-hidden="true" />,
        danger: true,
        onSelect: () => {
          confirm.ask({
            title: `Delete ${document.title}?`,
            body: 'Every version is removed from storage. This cannot be undone.',
            confirmLabel: 'Delete permanently',
            destructive: true,
            typedConfirmation: document.title,
            typedHint: `Type “${document.title}” to confirm`,
            onConfirm: () => remove.mutateAsync({ id: document.id, confirm: document.title }),
          });
        },
      });
    }

    return actions;
  };

  const columns: Array<TableColumn<DocumentListRow>> = [
    {
      id: 'title',
      header: 'Document',
      sortField: 'title',
      cell: (row) => (
        <span className="flex items-start gap-2">
          <FileText
            size={14}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--fd-text-tertiary)]"
          />
          <span className="min-w-0">
            <span className="block truncate font-medium text-[var(--fd-text-primary)]">
              {row.title}
            </span>
            <span className="text-2xs block truncate text-[var(--fd-text-tertiary)]">
              {row.originalFilename}
            </span>
          </span>
        </span>
      ),
    },
    ...(showClient
      ? [
          {
            id: 'client',
            header: 'Client',
            hideBelow: 'lg' as const,
            cell: (row: DocumentListRow) => row.client?.name ?? '—',
          },
        ]
      : []),
    {
      id: 'type',
      header: 'Type',
      sortField: 'documentType',
      cell: (row) => (
        <span className="text-[var(--fd-text-secondary)]">
          {row.documentType === 'other' && row.customTypeLabel !== null
            ? row.customTypeLabel
            : DOCUMENT_TYPE_LABELS[row.documentType]}
        </span>
      ),
    },
    {
      id: 'version',
      header: 'Version',
      hideBelow: 'md',
      cell: (row) => (
        <span className="numeric flex items-center gap-2 text-[var(--fd-text-secondary)]">
          v{row.currentVersion}
          {row.archived ? <Badge tone="muted">Archived</Badge> : null}
        </span>
      ),
    },
    {
      id: 'size',
      header: 'Size',
      align: 'right',
      hideBelow: 'lg',
      cell: (row) => <span className="numeric">{formatBytes(row.sizeBytes)}</span>,
    },
    {
      id: 'uploaded',
      header: 'Uploaded',
      sortField: 'createdAt',
      align: 'right',
      cell: (row) => <span className="numeric">{formatDate(row.createdAt)}</span>,
    },
  ];

  return (
    <>
      <DataTable
        caption="Documents"
        columns={columns}
        rows={documents}
        rowKey={(row) => row.id}
        state={loading ? 'loading' : 'ready'}
        emptySlot={emptySlot}
        rowActions={(row) => (
          <DropdownMenu
            ariaLabel={`Actions for ${row.title}`}
            actions={actionsFor(row)}
            trigger={
              <IconButton
                label={`Actions for ${row.title}`}
                size="sm"
                icon={<MoreVertical size={15} aria-hidden="true" />}
              />
            }
          />
        )}
      />

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
          {...(confirm.request.typedConfirmation === undefined
            ? {}
            : { typedConfirmation: confirm.request.typedConfirmation })}
          {...(confirm.request.typedHint === undefined
            ? {}
            : { typedHint: confirm.request.typedHint })}
        />
      )}
    </>
  );
}
