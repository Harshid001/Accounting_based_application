import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Upload } from 'lucide-react';
import { useState } from 'react';

import { getDocument, requestDownload } from '@/api/documents.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { ErrorState, InlineError } from '@/components/ui/error-state';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { IconButton } from '@/components/ui/icon-button';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { checkFile, useDocumentUpload } from '@/hooks/useDocumentUpload';
import { useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { formatDateTime } from '@/lib/date';
import { formatBytes, maskFilename } from '@/lib/format';
import { openPresignedUrl } from '@/lib/download';
import { MAX_DOCUMENT_VERSIONS } from '@/lib/constants';
import type { DocumentListRow } from '@/types/models';

export interface VersionHistoryProps {
  document: DocumentListRow | null;
  clientId: string;
  onClose: () => void;
}

export function VersionHistory({ document, clientId, onClose }: VersionHistoryProps) {
  const { allows } = useSession();
  const { success, errorToast } = useToast();
  const upload = useDocumentUpload();
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const documentId = document?.id ?? '';
  const query = useQuery({
    queryKey: queryKeys.documents.detail(documentId),
    queryFn: () => getDocument(documentId),
    enabled: documentId.length > 0,
  });

  const download = useMutation({
    mutationFn: async (version: number) => requestDownload(documentId, version),
    onSuccess: (ticket) => {
      openPresignedUrl(ticket.url);
    },
    onError: (error: unknown) => {
      errorToast(error, 'That download link could not be created');
    },
  });

  const busy =
    upload.phase === 'presigning' || upload.phase === 'transferring' || upload.phase === 'finalising';
  const versions = query.data?.versions ?? [];
  const atLimit = versions.length >= MAX_DOCUMENT_VERSIONS;

  const close = (): void => {
    setFile(null);
    setLocalError(null);
    upload.reset();
    onClose();
  };

  const onFileChange = (next: File | null): void => {
    setFile(next);
    setLocalError(null);
    upload.reset();
    if (next === null) return;
    const check = checkFile(next);
    if (!check.ok) setLocalError(check.message);
  };

  const submit = (): void => {
    if (file === null || document === null) return;
    void upload.uploadVersion({ clientId, documentId: document.id, file }).then((updated) => {
      if (updated !== null) {
        success('New version uploaded', `${updated.title} is now at v${updated.currentVersion}.`);
        setFile(null);
        void query.refetch();
      }
    });
  };

  return (
    <Sheet
      open={document !== null}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={document?.title ?? 'Version history'}
      description="Every version stays downloadable. The newest is what lists show."
    >
      {query.isPending && document !== null ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-12 w-full" rounded="lg" />
          <Skeleton className="h-12 w-full" rounded="lg" />
        </div>
      ) : query.isError ? (
        <ErrorState
          compact
          error={query.error}
          title="Versions did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <div className="space-y-5">
          <ul className="divide-y divide-[var(--fd-border-subtle)]">
            {versions.map((version) => (
              <li key={version.version} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="numeric text-base font-medium text-[var(--fd-text-primary)]">
                    v{version.version}
                    {version.version === query.data?.currentVersion ? ' · current' : ''}
                  </p>
                  <p className="text-2xs truncate text-[var(--fd-text-tertiary)]">
                    {maskFilename(version.originalFilename)} · {formatBytes(version.sizeBytes)} ·{' '}
                    {formatDateTime(version.uploadedAt)}
                  </p>
                </div>
                <IconButton
                  label={`Download version ${version.version}`}
                  size="sm"
                  icon={<Download size={14} aria-hidden="true" />}
                  onClick={() => {
                    download.mutate(version.version);
                  }}
                />
              </li>
            ))}
          </ul>

          {allows('document:version') && document !== null && !document.archived ? (
            <div className="space-y-3 border-t border-[var(--fd-border-subtle)] pt-4">
              <h3 className="text-lg font-semibold text-[var(--fd-text-primary)]">
                Upload a new version
              </h3>
              {atLimit ? (
                <InlineError
                  message={`This document already holds ${MAX_DOCUMENT_VERSIONS} versions. Create a new document instead.`}
                />
              ) : (
                <>
                  <FileDropzone
                    file={file}
                    onFileChange={onFileChange}
                    state={busy ? 'uploading' : localError !== null ? 'error' : 'idle'}
                    error={localError ?? upload.error}
                    progress={upload.progress}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    loading={busy}
                    loadingLabel="Uploading the new version"
                    disabled={file === null || localError !== null}
                    iconLeft={<Upload size={14} aria-hidden="true" />}
                    onClick={submit}
                  >
                    Upload version {versions.length + 1}
                  </Button>
                </>
              )}
            </div>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
