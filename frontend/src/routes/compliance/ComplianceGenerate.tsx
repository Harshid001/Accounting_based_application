import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { commitGeneration, previewGeneration } from '@/api/compliance.api';
import { listComplianceTypes } from '@/api/complianceTypes.api';
import { queryKeys } from '@/api/queryKeys';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { FieldRow, FormField } from '@/components/ui/form-field';
import { InlineError } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { GeneratePreview } from '@/routes/compliance/components/GeneratePreview';
import { useToast } from '@/context/ToastContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { CATEGORY_LABELS, SEEDED_DUE_DATE_HINT } from '@/lib/constants';
import { fieldErrorMap, normaliseError } from '@/lib/errors';
import { generateSchema } from '@/schemas/compliance.schema';
import type { GenerateValues } from '@/schemas/compliance.schema';
import type { GeneratePreview as Preview } from '@/types/models';

export function ComplianceGenerate() {
  usePageTitle('Generate filings');
  const navigate = useNavigate();
  const { success } = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const catalogue = useQuery({
    queryKey: queryKeys.complianceTypes.list({ active: 'true', isRecurring: 'true' }),
    queryFn: () => listComplianceTypes({ active: 'true', isRecurring: 'true' }),
    staleTime: 5 * 60_000,
  });

  const form = useForm<GenerateValues>({
    resolver: zodResolver(generateSchema),
    defaultValues: { complianceTypeId: '', periodStart: '', periodEnd: '', clientIds: [] },
  });

  const handleError = (error: unknown): void => {
    const normalised = normaliseError(error);
    setFormError(normalised.message);
    for (const [field, message] of Object.entries(fieldErrorMap(normalised))) {
      form.setError(field as keyof GenerateValues, { type: 'server', message });
    }
  };

  const previewMutation = useMutation({
    mutationFn: previewGeneration,
    onSuccess: setPreview,
    onError: handleError,
  });

  const commitMutation = useMutation({
    mutationFn: commitGeneration,
    onSuccess: (result) => {
      success(
        'Filings generated',
        `${result.created} created, ${result.skipped} skipped, ${result.requestsCreated} document requests raised.`,
      );
      void navigate('/compliance');
    },
    onError: handleError,
  });

  const runPreview = form.handleSubmit(async (values) => {
    setFormError(null);
    setPreview(null);
    await previewMutation
      .mutateAsync({
        complianceTypeId: values.complianceTypeId,
        periodStart: values.periodStart,
        periodEnd: values.periodEnd,
      })
      .catch(() => undefined);
  });

  const commit = (): void => {
    setFormError(null);
    const values = form.getValues();
    commitMutation.mutate({
      complianceTypeId: values.complianceTypeId,
      periodStart: values.periodStart,
      periodEnd: values.periodEnd,
    });
  };

  return (
    <>
      <PageHeader
        breadcrumb={
          <Breadcrumb
            items={[{ label: 'Filings', to: '/compliance' }, { label: 'Generate filings' }]}
          />
        }
        title="Generate filings"
        description="Pick a filing and a date range. FirmDesk shows exactly what it will create before it writes anything."
      />

      <div className="max-w-[880px] space-y-4">
        <Card>
          <CardHeader
            title="What to generate"
            description="Every client with an active service for this filing is included. Running this twice creates nothing extra."
          />
          <form
            onSubmit={(event) => {
              void runPreview(event);
            }}
            className="space-y-4"
            noValidate
          >
            {formError === null ? null : <InlineError message={formError} />}

            <FormField
              label="Filing"
              required
              helper={SEEDED_DUE_DATE_HINT}
              error={form.formState.errors.complianceTypeId?.message}
            >
              {({ inputId, describedBy, invalid }) => (
                <Controller
                  control={form.control}
                  name="complianceTypeId"
                  render={({ field }) => (
                    <Select
                      id={inputId}
                      ariaLabel="Filing"
                      ariaDescribedBy={describedBy}
                      invalid={invalid}
                      value={field.value}
                      onValueChange={field.onChange}
                      options={(catalogue.data ?? []).map((type) => ({
                        value: type.id,
                        label: `${type.name} (${CATEGORY_LABELS[type.category]})`,
                      }))}
                    />
                  )}
                />
              )}
            </FormField>

            <FieldRow>
              <FormField
                label="Range starts"
                required
                error={form.formState.errors.periodStart?.message}
              >
                {({ inputId, describedBy, invalid }) => (
                  <Controller
                    control={form.control}
                    name="periodStart"
                    render={({ field }) => (
                      <DatePicker
                        id={inputId}
                        ariaLabel="Range starts"
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

              <FormField
                label="Range ends"
                required
                error={form.formState.errors.periodEnd?.message}
              >
                {({ inputId, describedBy, invalid }) => (
                  <Controller
                    control={form.control}
                    name="periodEnd"
                    render={({ field }) => (
                      <DatePicker
                        id={inputId}
                        ariaLabel="Range ends"
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
            </FieldRow>

            <Button
              type="submit"
              variant="secondary"
              loading={previewMutation.isPending}
              loadingLabel="Working out what would be created"
            >
              Preview what this creates
            </Button>
          </form>
        </Card>

        {preview === null ? null : (
          <>
            <GeneratePreview preview={preview} />

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setPreview(null);
                }}
              >
                Change the range
              </Button>
              <Button
                variant="primary"
                disabled={preview.willCreate.length === 0}
                loading={commitMutation.isPending}
                loadingLabel="Creating these filings"
                onClick={commit}
              >
                Create {preview.willCreate.length} filings
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
