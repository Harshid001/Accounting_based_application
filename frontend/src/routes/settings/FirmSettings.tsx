import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { fetchFirmSettings, updateFirmSettings } from '@/api/settings.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { FieldRow, Fieldset, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { SettingsNav } from '@/routes/settings/components/SettingsNav';
import { useToast } from '@/context/ToastContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { fieldErrorMap, normaliseError } from '@/lib/errors';
import { firmSettingsSchema, toFirmSettingsPayload } from '@/schemas/user.schema';
import type { FirmSettingsValues } from '@/schemas/user.schema';

export function FirmSettings() {
  usePageTitle('Firm settings');
  const queryClient = useQueryClient();
  const { success } = useToast();

  const query = useQuery({
    queryKey: queryKeys.settings.firm,
    queryFn: fetchFirmSettings,
  });

  const form = useForm<FirmSettingsValues>({
    resolver: zodResolver(firmSettingsSchema),
    defaultValues: {
      firmName: '',
      contactEmail: '',
      contactPhone: '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      pincode: '',
      defaultReminderOffsetsDays: '7, 3, 1',
      complianceHorizonDays: '120',
    },
  });

  useEffect(() => {
    const settings = query.data;
    if (settings === undefined) return;
    form.reset({
      firmName: settings.firmName,
      contactEmail: settings.contactEmail ?? '',
      contactPhone: settings.contactPhone ?? '',
      line1: settings.address?.line1 ?? '',
      line2: settings.address?.line2 ?? '',
      city: settings.address?.city ?? '',
      state: settings.address?.state ?? '',
      pincode: settings.address?.pincode ?? '',
      defaultReminderOffsetsDays: (settings.defaultReminderOffsetsDays ?? [7, 3, 1]).join(', '),
      complianceHorizonDays: String(settings.complianceHorizonDays ?? 120),
    });
  }, [query.data, form]);

  const mutation = useMutation({
    mutationFn: (values: FirmSettingsValues) => updateFirmSettings(toFirmSettingsPayload(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.firm });
      success('Firm settings saved');
    },
    onError: (error: unknown) => {
      const normalised = normaliseError(error);
      for (const [field, message] of Object.entries(fieldErrorMap(normalised))) {
        form.setError(field as keyof FirmSettingsValues, { type: 'server', message });
      }
    },
  });

  const submit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync(values).catch(() => undefined);
  });

  return (
    <>
      <PageHeader
        title="Settings"
        description="Firm details, the compliance catalogue, users and the audit trail."
      />
      <SettingsNav />

      {query.isError ? (
        <ErrorState
          error={query.error}
          title="Firm settings did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : query.isPending ? (
        <div className="max-w-[880px] space-y-4" aria-busy="true">
          <Skeleton className="h-48 w-full" rounded="lg" />
          <Skeleton className="h-48 w-full" rounded="lg" />
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            void submit(event);
          }}
          className="max-w-[880px] space-y-4"
          noValidate
        >
          <Card>
            <Fieldset legend="Firm details" description="These appear on printed reports.">
              <FormField label="Firm name" required error={form.formState.errors.firmName?.message}>
                {({ inputId, describedBy, invalid }) => (
                  <Input
                    id={inputId}
                    invalid={invalid}
                    aria-describedby={describedBy}
                    {...form.register('firmName')}
                  />
                )}
              </FormField>

              <FieldRow>
                <FormField
                  label="Contact email"
                  error={form.formState.errors.contactEmail?.message}
                >
                  {({ inputId, describedBy, invalid }) => (
                    <Input
                      id={inputId}
                      type="email"
                      invalid={invalid}
                      aria-describedby={describedBy}
                      {...form.register('contactEmail')}
                    />
                  )}
                </FormField>
                <FormField
                  label="Contact phone"
                  error={form.formState.errors.contactPhone?.message}
                >
                  {({ inputId, describedBy, invalid }) => (
                    <Input
                      id={inputId}
                      className="numeric"
                      invalid={invalid}
                      aria-describedby={describedBy}
                      {...form.register('contactPhone')}
                    />
                  )}
                </FormField>
              </FieldRow>
            </Fieldset>
          </Card>

          <Card>
            <Fieldset legend="Address">
              <FormField label="Address line 1" error={form.formState.errors.line1?.message}>
                {({ inputId, describedBy, invalid }) => (
                  <Input
                    id={inputId}
                    invalid={invalid}
                    aria-describedby={describedBy}
                    {...form.register('line1')}
                  />
                )}
              </FormField>
              <FormField label="Address line 2" error={form.formState.errors.line2?.message}>
                {({ inputId, describedBy, invalid }) => (
                  <Input
                    id={inputId}
                    invalid={invalid}
                    aria-describedby={describedBy}
                    {...form.register('line2')}
                  />
                )}
              </FormField>
              <FieldRow>
                <FormField label="City" error={form.formState.errors.city?.message}>
                  {({ inputId, describedBy, invalid }) => (
                    <Input
                      id={inputId}
                      invalid={invalid}
                      aria-describedby={describedBy}
                      {...form.register('city')}
                    />
                  )}
                </FormField>
                <FormField label="Pincode" error={form.formState.errors.pincode?.message}>
                  {({ inputId, describedBy, invalid }) => (
                    <Input
                      id={inputId}
                      inputMode="numeric"
                      className="numeric"
                      invalid={invalid}
                      aria-describedby={describedBy}
                      {...form.register('pincode')}
                    />
                  )}
                </FormField>
              </FieldRow>
              <FormField label="State" error={form.formState.errors.state?.message}>
                {({ inputId, describedBy, invalid }) => (
                  <Input
                    id={inputId}
                    invalid={invalid}
                    aria-describedby={describedBy}
                    {...form.register('state')}
                  />
                )}
              </FormField>
            </Fieldset>
          </Card>

          <Card>
            <CardHeader
              title="Scheduling defaults"
              description="How far ahead FirmDesk generates filings, and when it reminds staff."
            />
            <FieldRow>
              <FormField
                label="Reminder offsets in days"
                helper="Comma separated, up to six. For example 7, 3, 1."
                error={form.formState.errors.defaultReminderOffsetsDays?.message}
              >
                {({ inputId, describedBy, invalid }) => (
                  <Input
                    id={inputId}
                    className="numeric"
                    invalid={invalid}
                    aria-describedby={describedBy}
                    {...form.register('defaultReminderOffsetsDays')}
                  />
                )}
              </FormField>

              <FormField
                label="Generation horizon in days"
                helper="How far into the future the nightly job keeps filings populated."
                error={form.formState.errors.complianceHorizonDays?.message}
              >
                {({ inputId, describedBy, invalid }) => (
                  <Input
                    id={inputId}
                    inputMode="numeric"
                    className="numeric"
                    invalid={invalid}
                    aria-describedby={describedBy}
                    {...form.register('complianceHorizonDays')}
                  />
                )}
              </FormField>
            </FieldRow>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              loading={mutation.isPending}
              loadingLabel="Saving firm settings"
            >
              Save settings
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
