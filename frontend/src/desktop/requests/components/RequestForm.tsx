import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useState } from 'react';

import { createDocumentRequest } from '@/api/documentRequests.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { InlineError } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DocumentTypeSelect } from '@/components/domain/DocumentTypeSelect';
import { useToast } from '@/context/ToastContext';
import { fieldErrorMap, normaliseError } from '@/lib/errors';
import {
  documentRequestSchema,
  emptyDocumentRequest,
  toRequestPayload,
} from '@/schemas/documentRequest.schema';
import type { DocumentRequestValues } from '@/schemas/documentRequest.schema';

export interface RequestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  complianceItemId?: string;
}

export function RequestForm({ open, onOpenChange, clientId, complianceItemId }: RequestFormProps) {
  const queryClient = useQueryClient();
  const { success } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<DocumentRequestValues>({
    resolver: zodResolver(documentRequestSchema),
    defaultValues: { ...emptyDocumentRequest, complianceItemId: complianceItemId ?? '' },
  });

  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      form.reset({ ...emptyDocumentRequest, complianceItemId: complianceItemId ?? '' });
      setFormError(null);
    }
  }

  const mutation = useMutation({
    mutationFn: (values: DocumentRequestValues) =>
      createDocumentRequest(clientId, toRequestPayload(values)),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.documentRequests.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.compliance.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      success(
        'Request raised',
        `${created[0]?.title ?? 'The request'} is now visible in the client portal.`,
      );
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const normalised = normaliseError(error);
      setFormError(normalised.message);
      for (const [field, message] of Object.entries(fieldErrorMap(normalised))) {
        form.setError(field as keyof DocumentRequestValues, { type: 'server', message });
      }
    },
  });

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    await mutation.mutateAsync(values).catch(() => undefined);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Ask the client for a document"
      description="This appears in their portal immediately. No email is sent unless you send a reminder."
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            loadingLabel="Raising this request"
            onClick={() => {
              void submit();
            }}
          >
            Raise request
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError === null ? null : <InlineError message={formError} />}

        <FormField
          label="What do you need?"
          required
          error={form.formState.errors.title?.message}
        >
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              invalid={invalid}
              aria-describedby={describedBy}
              placeholder="Bank statement for March 2026"
              {...form.register('title')}
            />
          )}
        </FormField>

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

        <FormField
          label="Anything else they should know?"
          error={form.formState.errors.description?.message}
        >
          {({ inputId, describedBy, invalid }) => (
            <Textarea
              id={inputId}
              rows={3}
              invalid={invalid}
              aria-describedby={describedBy}
              placeholder="PDF from net banking is fine, we do not need a stamped copy."
              {...form.register('description')}
            />
          )}
        </FormField>

        <FormField label="Due date" error={form.formState.errors.dueDate?.message}>
          {({ inputId, describedBy, invalid }) => (
            <Controller
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <DatePicker
                  id={inputId}
                  ariaLabel="Due date"
                  ariaDescribedBy={describedBy}
                  invalid={invalid}
                  value={field.value.length === 0 ? null : field.value}
                  onChange={(value) => {
                    field.onChange(value ?? '');
                  }}
                />
              )}
            />
          )}
        </FormField>
      </div>
    </Dialog>
  );
}
