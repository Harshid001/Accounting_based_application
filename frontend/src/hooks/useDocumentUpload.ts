import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { putToStorage } from '@/api/client';
import { addDocumentVersion, finaliseUpload, presignUpload } from '@/api/documents.api';
import { queryKeys } from '@/api/queryKeys';
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_UPLOADS,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
} from '@/lib/constants';
import { ApiError, normaliseError } from '@/lib/errors';
import type { DocumentType } from '@/types/enums';
import type { DocumentDetail } from '@/types/models';

export interface UploadCheck {
  ok: boolean;
  mimeType: string;
  message: string | null;
}

const extensionOf = (filename: string): string => {
  const dot = filename.lastIndexOf('.');
  return dot < 0 ? '' : filename.slice(dot + 1).toLowerCase();
};

export const checkFile = (file: File): UploadCheck => {
  const extension = extensionOf(file.name);
  const match = ALLOWED_UPLOADS.find((entry) => entry.extension === extension);

  if (match === undefined) {
    return {
      ok: false,
      mimeType: '',
      message: `FirmDesk accepts ${ALLOWED_EXTENSIONS.join(', ').toUpperCase()} files. That file ends in ${
        extension.length > 0 ? `.${extension}` : 'no extension'
      }.`,
    };
  }
  if (file.size <= 0) {
    return { ok: false, mimeType: match.mimeType, message: 'That file is empty.' };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      mimeType: match.mimeType,
      message: `That file is larger than the ${MAX_UPLOAD_LABEL} limit. Split or compress it first.`,
    };
  }
  return { ok: true, mimeType: match.mimeType, message: null };
};

export type UploadPhase = 'idle' | 'presigning' | 'transferring' | 'finalising' | 'done' | 'error';

export interface UploadNewInput {
  clientId: string;
  file: File;
  title: string;
  documentType: DocumentType;
  customTypeLabel?: string | null;
  complianceItemId?: string | null;
  documentRequestId?: string | null;
}

export interface UploadVersionInput {
  clientId: string;
  documentId: string;
  file: File;
}

export interface DocumentUpload {
  phase: UploadPhase;
  progress: number;
  error: string | null;
  reset: () => void;
  uploadNew: (input: UploadNewInput) => Promise<DocumentDetail | null>;
  uploadVersion: (input: UploadVersionInput) => Promise<DocumentDetail | null>;
}

const PROGRESS: Record<UploadPhase, number> = {
  idle: 0,
  presigning: 15,
  transferring: 60,
  finalising: 90,
  done: 100,
  error: 0,
};

export function useDocumentUpload(): DocumentUpload {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
  }, []);

  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.documentRequests.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.portal.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.compliance.all }),
    ]);
  }, [queryClient]);

  const transfer = useCallback(
    async (clientId: string, file: File, mimeType: string): Promise<string> => {
      setPhase('presigning');
      const ticket = await presignUpload({
        clientId,
        filename: file.name,
        mimeType,
        sizeBytes: file.size,
      });
      setPhase('transferring');
      await putToStorage(ticket.uploadUrl, file, mimeType);
      return ticket.storageKey;
    },
    [],
  );

  const guard = useCallback((file: File): UploadCheck => {
    const check = checkFile(file);
    if (!check.ok) {
      setPhase('error');
      setError(check.message);
    }
    return check;
  }, []);

  const handleFailure = useCallback((cause: unknown): null => {
    const normalised = normaliseError(cause);
    setPhase('error');
    setError(normalised.message);
    if (!(cause instanceof ApiError)) throw cause;
    return null;
  }, []);

  const uploadNew = useCallback(
    async (input: UploadNewInput): Promise<DocumentDetail | null> => {
      const check = guard(input.file);
      if (!check.ok) return null;
      setError(null);
      try {
        const storageKey = await transfer(input.clientId, input.file, check.mimeType);
        setPhase('finalising');
        const created = await finaliseUpload({
          clientId: input.clientId,
          storageKey,
          filename: input.file.name,
          mimeType: check.mimeType,
          title: input.title,
          documentType: input.documentType,
          customTypeLabel: input.customTypeLabel ?? null,
          complianceItemId: input.complianceItemId ?? null,
          documentRequestId: input.documentRequestId ?? null,
        });
        await invalidate();
        setPhase('done');
        return created;
      } catch (cause) {
        return handleFailure(cause);
      }
    },
    [guard, transfer, invalidate, handleFailure],
  );

  const uploadVersion = useCallback(
    async (input: UploadVersionInput): Promise<DocumentDetail | null> => {
      const check = guard(input.file);
      if (!check.ok) return null;
      setError(null);
      try {
        const storageKey = await transfer(input.clientId, input.file, check.mimeType);
        setPhase('finalising');
        const updated = await addDocumentVersion(input.documentId, {
          storageKey,
          filename: input.file.name,
          mimeType: check.mimeType,
        });
        await invalidate();
        setPhase('done');
        return updated;
      } catch (cause) {
        return handleFailure(cause);
      }
    },
    [guard, transfer, invalidate, handleFailure],
  );

  return { phase, progress: PROGRESS[phase], error, reset, uploadNew, uploadVersion };
}
