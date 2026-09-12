import { useQuery } from '@tanstack/react-query';
import { Check, FileCheck, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { listClients } from '@/api/clients.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/context/ToastContext';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
import { DOCUMENT_TYPE_LABELS } from '@/lib/constants';
import type { ConversionResult } from '@/lib/converter/types';
import { DOCUMENT_TYPES } from '@/types/enums';
import type { DocumentType } from '@/types/enums';

export interface SaveToVaultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversionResult: ConversionResult | null;
}

export function SaveToVaultDialog({
  open,
  onOpenChange,
  conversionResult,
}: SaveToVaultDialogProps) {
  const { toast } = useToast();
  const { uploadNew, phase: uploadPhase, error: uploadError, reset } = useDocumentUpload();

  const [clientId, setClientId] = useState<string>('');
  const [documentType, setDocumentType] = useState<DocumentType>('other');
  const [title, setTitle] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState(false);

  const clientsQuery = useQuery({
    queryKey: queryKeys.clients.list({ limit: 100 }),
    queryFn: ({ signal }) => listClients({ limit: 100 }, signal),
    enabled: open,
  });

  const isUploading = uploadPhase === 'presigning' ||
    uploadPhase === 'transferring' ||
    uploadPhase === 'finalising';

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset();
      setIsSuccess(false);
    } else if (conversionResult) {
      setTitle(conversionResult.outputFileName);
    }
    onOpenChange(nextOpen);
  };

  const handleSave = async () => {
    if (!conversionResult || !clientId) return;

    try {
      const file = new File([conversionResult.blob], conversionResult.outputFileName, {
        type: conversionResult.mimeType,
      });

      await uploadNew({
        clientId,
        file,
        title: title.trim() || conversionResult.outputFileName,
        documentType,
      });

      setIsSuccess(true);
      toast({
        tone: 'success',
        title: 'Saved to Vault',
        description: `"${title || conversionResult.outputFileName}" has been securely uploaded to the client vault.`,
      });

      setTimeout(() => {
        handleOpenChange(false);
      }, 1200);
    } catch {
      // Error handled by useDocumentUpload and displayed in dialog
    }
  };

  const footer = isSuccess ? null : (
    <div className="flex w-full items-center justify-end gap-2">
      <Button
        variant="secondary"
        onClick={() => handleOpenChange(false)}
        disabled={isUploading}
      >
        Cancel
      </Button>
      <Button
        variant="primary"
        onClick={handleSave}
        disabled={!clientId || !title.trim() || isUploading}
        className="gap-1.5"
      >
        {isUploading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            <span>Uploading to Vault...</span>
          </>
        ) : (
          <>
            <FileCheck size={14} />
            <span>Save to Vault</span>
          </>
        )}
      </Button>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Save to Client Vault"
      description="Store this converted file directly into a client's document vault with proper compliance classification."
      footer={footer}
    >
      {isSuccess ? (
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--fd-status-done)]/15 text-[var(--fd-status-done)]">
            <Check size={24} />
          </div>
          <h4 className="text-base font-semibold text-[var(--fd-text-primary)]">
            Successfully Saved!
          </h4>
          <p className="text-xs text-[var(--fd-text-secondary)]">
            The document is now active in the client's file vault.
          </p>
        </div>
      ) : (
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label htmlFor="vault-client-select" className="text-xs font-medium text-[var(--fd-text-secondary)]">
              Select Client <span className="text-red-500">*</span>
            </label>
            <select
              id="vault-client-select"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={isUploading || clientsQuery.isPending}
              className="flex h-9 w-full rounded-md border border-[var(--fd-border)] bg-[var(--fd-surface-1)] px-3 text-sm text-[var(--fd-text-primary)] outline-none focus:border-[var(--fd-accent)]"
            >
              <option value="">-- Choose a Client --</option>
              {clientsQuery.data?.items.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.displayName} ({client.clientType})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="vault-doc-type" className="text-xs font-medium text-[var(--fd-text-secondary)]">
              Document Classification <span className="text-red-500">*</span>
            </label>
            <select
              id="vault-doc-type"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              disabled={isUploading}
              className="flex h-9 w-full rounded-md border border-[var(--fd-border)] bg-[var(--fd-surface-1)] px-3 text-sm text-[var(--fd-text-primary)] outline-none focus:border-[var(--fd-accent)]"
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {DOCUMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="vault-doc-title" className="text-xs font-medium text-[var(--fd-text-secondary)]">
              Document Title <span className="text-red-500">*</span>
            </label>
            <Input
              id="vault-doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document Title"
              disabled={isUploading}
            />
          </div>

          {conversionResult && (
            <div className="rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] p-3 text-xs space-y-1">
              <div className="flex items-center justify-between text-[var(--fd-text-secondary)]">
                <span>File:</span>
                <span className="font-mono font-medium text-[var(--fd-text-primary)] truncate max-w-[200px]">
                  {conversionResult.outputFileName}
                </span>
              </div>
              <div className="flex items-center justify-between text-[var(--fd-text-secondary)]">
                <span>Output Size:</span>
                <span className="font-medium text-[var(--fd-text-primary)]">
                  {conversionResult.outputSizeFormatted}
                </span>
              </div>
            </div>
          )}

          {uploadError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {uploadError}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
