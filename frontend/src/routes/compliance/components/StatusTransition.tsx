import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';

import { changeComplianceStatus } from '@/api/compliance.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField } from '@/components/ui/form-field';
import { InlineError } from '@/components/ui/error-state';
import { Textarea } from '@/components/ui/textarea';
import { ComplianceStatusSelect } from '@/components/domain/ComplianceStatusSelect';
import { useToast } from '@/context/ToastContext';
import { fieldErrorMap, normaliseError } from '@/lib/errors';
import { complianceStatusSchema } from '@/schemas/compliance.schema';
import type { ComplianceStatusValues } from '@/schemas/compliance.schema';
import { COMPLIANCE_TRANSITIONS } from '@/types/enums';
import type { ComplianceStatus } from '@/types/enums';

export interface StatusTransitionProps {
  complianceId: string;
  current: ComplianceStatus;
  filedDate: string | null;
  disabled: boolean;
}

export function StatusTransition({
  complianceId,
  current,
  filedDate,
  disabled,
}: StatusTransitionProps) {
  const queryClient = useQueryClient();
  const { success } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ComplianceStatusValues>({
    resolver: zodResolver(complianceStatusSchema),
    defaultValues: {
      status: current,
      filedDate: filedDate ?? '',
      notApplicableReason: '',
    },
  });

  useEffect(() => {
    form.reset({ status: current, filedDate: filedDate ?? '', notApplicableReason: '' });
  }, [current, filedDate, form]);

  const next = form.watch('status');
  const terminal = COMPLIANCE_TRANSITIONS[current].length === 0;

  const mutation = useMutation({
    mutationFn: (values: ComplianceStatusValues) =>
      changeComplianceStatus(complianceId, {
        status: values.status,
        ...(values.filedDate.length === 0 ? {} : { filedDate: values.filedDate }),
        ...(values.notApplicableReason.trim().length === 0
          ? {}
          : { notApplicableReason: values.notApplicableReason.trim() }),
      }),
    onSuccess: (item) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.compliance.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myWork() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
      success(
        'Status updated',
        item.status === 'awaiting_client'
          ? 'The client now sees this as an action for them.'
          : undefined,
      );
    },
    onError: (error: unknown) => {
      const normalised = normaliseError(error);
      setFormError(normalised.message);
      for (const [field, message] of Object.entries(fieldErrorMap(normalised))) {
        form.setError(field as keyof ComplianceStatusValues, { type: 'server', message });
      }
    },
  });

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    await mutation.mutateAsync(values).catch(() => undefined);
  });

  if (terminal) {
    return (
      <Card>
        <CardHeader title="Status" as="h3" />
        <p className="text-base text-[var(--fd-text-secondary)]">
          This filing is acknowledged, which is terminal. If it was recorded wrongly an
          administrator has to delete it and create it again.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Move this filing on" as="h3" />
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        className="space-y-3"
      >
        {formError === null ? null : <InlineError message={formError} />}

        <FormField label="New status">
          {({ inputId }) => (
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <ComplianceStatusSelect
                  id={inputId}
                  from={current}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={disabled}
                />
              )}
            />
          )}
        </FormField>

        {next === 'filed' || next === 'acknowledged' ? (
          <FormField
            label="Date filed"
            required
            error={form.formState.errors.filedDate?.message}
          >
            {({ inputId, describedBy, invalid }) => (
              <Controller
                control={form.control}
                name="filedDate"
                render={({ field }) => (
                  <DatePicker
                    id={inputId}
                    ariaLabel="Date filed"
                    ariaDescribedBy={describedBy}
                    invalid={invalid}
                    disabled={disabled}
                    value={field.value.length === 0 ? null : field.value}
                    onChange={(value) => {
                      field.onChange(value ?? '');
                    }}
                  />
                )}
              />
            )}
          </FormField>
        ) : null}

        {next === 'not_applicable' ? (
          <FormField
            label="Why does this not apply?"
            required
            error={form.formState.errors.notApplicableReason?.message}
          >
            {({ inputId, describedBy, invalid }) => (
              <Textarea
                id={inputId}
                rows={2}
                invalid={invalid}
                disabled={disabled}
                aria-describedby={describedBy}
                placeholder="Registration surrendered in June 2026."
                {...form.register('notApplicableReason')}
              />
            )}
          </FormField>
        ) : null}

        {next === 'awaiting_client' ? (
          <p className="rounded-md border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] px-3 py-2 text-xs text-[var(--fd-text-secondary)]">
            Moving to awaiting client publishes this filing to their portal and notifies them in the
            app. No email is sent.
          </p>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={disabled || next === current}
          loading={mutation.isPending}
          loadingLabel="Saving the new status"
        >
          Update status
        </Button>
      </form>
    </Card>
  );
}
