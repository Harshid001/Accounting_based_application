import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { DocumentTypeSelect } from '@/components/domain/DocumentTypeSelect';
import { useDocumentUpload, checkFile } from '@/hooks/useDocumentUpload';
import { useToast } from '@/context/ToastContext';
import {
  documentUploadSchema,
  emptyDocumentUpload,
  titleFromFilename,
} from '@/schemas/document.schema';
import type { DocumentUploadValues } from '@/schemas/document.schema';
import type { DocumentType } from '@/types/enums';

export interface DocumentUploaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  complianceItemId?: string | null;
  documentRequestId?: string | null;
  fixedDocumentType?: DocumentType;
  title?: string;
  onUploaded?: () => void;
}

export function DocumentUploader({
  open,
  onOpenChange,
  clientId,
  complianceItemId,
  documentRequestId,
  fixedDocumentType,
  title = 'Upload a document',
  onUploaded,
}: DocumentUploaderProps) {
  const upload = useDocumentUpload();
  const { success } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const form = useForm<DocumentUploadValues>({
    resolver: zodResolver(documentUploadSchema),
    defaultValues: {
      ...emptyDocumentUpload,
      ...(fixedDocumentType === undefined ? {} : { documentType: fixedDocumentType }),
    },
  });

  const documentType = form.watch('documentType');
  const busy = upload.phase === 'presigning' || upload.phase === 'transferring' || upload.phase === 'finalising';

  const close = (): void => {
    setFile(null);
    setLocalError(null);
    upload.reset();
    form.reset({
      ...emptyDocumentUpload,
      ...(fixedDocumentType === undefined ? {} : { documentType: fixedDocumentType }),
    });
    onOpenChange(false);
  };

  const onFileChange = (next: File | null): void => {
    setFile(next);
    setLocalError(null);
    upload.reset();
    if (next === null) return;
    const check = checkFile(next);
    if (!check.ok) {
      setLocalError(check.message);
      return;
    }
    if (form.getValues('title').trim().length === 0) {
      form.setValue('title', titleFromFilename(next.name), { shouldValidate: false });
    }
  };

  const submit = form.handleSubmit(async (values) => {
    if (file === null) {
      setLocalError('Choose a file before uploading.');
      return;
    }
    const created = await upload.uploadNew({
      clientId,
      file,
      title: values.title,
      documentType: values.documentType,
      customTypeLabel: values.customTypeLabel.trim().length === 0 ? null : values.customTypeLabel,
      complianceItemId: complianceItemId ?? null,
      documentRequestId: documentRequestId ?? null,
    });
    if (created !== null) {
      success('Document uploaded', `${created.title} is now on file.`);
      onUploaded?.();
      close();
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={title}
      description="Files go straight from your browser to secure storage."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            loadingLabel="Uploading your file"
            disabled={file === null || localError !== null}
            onClick={() => {
              void submit();
            }}
          >
            Upload document
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FileDropzone
          file={file}
          onFileChange={onFileChange}
          state={busy ? 'uploading' : localError !== null || upload.error !== null ? 'error' : 'idle'}
          error={localError ?? upload.error}
          progress={upload.progress}
        />

        <FormField label="Title" required error={form.formState.errors.title?.message}>
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              invalid={invalid}
              aria-describedby={describedBy}
              placeholder="Bank statement — Mar 2026"
              {...form.register('title')}
            />
          )}
        </FormField>

        {fixedDocumentType === undefined ? (
          <FormField label="Document type" required>
            {({ inputId, describedBy }) => (
              <Controller
                control={form.control}
                name="documentType"
                render={({ field }) => (
                  <DocumentTypeSelect
                    id={inputId}
                    ariaDescribedBy={describedBy}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            )}
          </FormField>
        ) : null}

        {documentType === 'other' ? (
          <FormField
            label="What kind of document is it?"
            required
            error={form.formState.errors.customTypeLabel?.message}
          >
            {({ inputId, describedBy, invalid }) => (
              <Input
                id={inputId}
                invalid={invalid}
                aria-describedby={describedBy}
                placeholder="Partnership deed"
                {...form.register('customTypeLabel')}
              />
            )}
          </FormField>
        ) : null}
      </div>
    </Dialog>
  );
}
