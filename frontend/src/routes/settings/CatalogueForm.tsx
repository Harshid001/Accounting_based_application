import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import {
  createComplianceType,
  getComplianceType,
  updateComplianceType,
} from '@/api/complianceTypes.api';
import { queryKeys } from '@/api/queryKeys';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorState } from '@/components/ui/error-state';
import { FieldRow, Fieldset, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ChecklistEditor } from '@/routes/settings/components/ChecklistEditor';
import { DueDateRuleEditor } from '@/routes/settings/components/DueDateRuleEditor';
import { SettingsNav } from '@/routes/settings/components/SettingsNav';
import { useToast } from '@/context/ToastContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { CATEGORY_LABELS, FREQUENCY_LABELS } from '@/lib/constants';
import { fieldErrorMap, normaliseError } from '@/lib/errors';
import {
  complianceTypeSchema,
  emptyComplianceType,
  toComplianceTypePayload,
} from '@/schemas/complianceType.schema';
import type { ComplianceTypeFormValues } from '@/schemas/complianceType.schema';
import { COMPLIANCE_CATEGORIES, FREQUENCIES } from '@/types/enums';
import type { ComplianceTypeView } from '@/types/models';

const toFormValues = (type: ComplianceTypeView): ComplianceTypeFormValues => {
  const rule = type.dueDateRule;
  return {
    ...emptyComplianceType,
    name: type.name,
    code: type.code,
    category: type.category,
    isRecurring: type.isRecurring,
    defaultFrequency: type.defaultFrequency,
    ruleKind: rule?.kind ?? 'day_of_following_month',
    ruleDay: rule !== null && 'day' in rule ? String(rule.day) : '20',
    ruleMonthsAfter:
      rule !== null && rule.kind === 'day_of_following_month' ? String(rule.monthsAfter) : '1',
    ruleDays: rule !== null && rule.kind === 'days_after_period_end' ? String(rule.days) : '30',
    ruleMonth:
      rule !== null && rule.kind === 'fixed_day_month_after_period' ? String(rule.month) : '10',
    ruleYearsAfter:
      rule !== null && rule.kind === 'fixed_day_month_after_period' ? String(rule.yearsAfter) : '0',
    reminderOffsetsDays: type.reminderOffsetsDays.join(', '),
    defaultDocumentChecklist: type.defaultDocumentChecklist.map((entry) => ({
      title: entry.title,
      documentType: entry.documentType,
      description: entry.description ?? '',
    })),
    active: type.active,
  };
};

export function CatalogueForm() {
  const { typeId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success } = useToast();
  const editing = typeId !== undefined;

  const query = useQuery({
    queryKey: queryKeys.complianceTypes.detail(typeId ?? ''),
    queryFn: () => getComplianceType(typeId ?? ''),
    enabled: editing,
  });

  usePageTitle(editing ? (query.data?.name ?? 'Catalogue entry') : 'Add a catalogue entry');

  const form = useForm<ComplianceTypeFormValues>({
    resolver: zodResolver(complianceTypeSchema),
    defaultValues: emptyComplianceType,
  });

  const checklist = useFieldArray({
    control: form.control,
    name: 'defaultDocumentChecklist',
  });

  useEffect(() => {
    if (query.data === undefined) return;
    form.reset(toFormValues(query.data));
  }, [query.data, form]);

  const mutation = useMutation({
    mutationFn: (values: ComplianceTypeFormValues) =>
      editing
        ? updateComplianceType(typeId, toComplianceTypePayload(values, { includeCode: false }))
        : createComplianceType(toComplianceTypePayload(values, { includeCode: true })),
    onSuccess: (type) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.complianceTypes.all });
      success(editing ? 'Catalogue entry saved' : 'Catalogue entry added', type.name);
      void navigate('/settings/catalogue');
    },
    onError: (error: unknown) => {
      const normalised = normaliseError(error);
      for (const [field, message] of Object.entries(fieldErrorMap(normalised))) {
        form.setError(field as keyof ComplianceTypeFormValues, { type: 'server', message });
      }
    },
  });

  const submit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync(values).catch(() => undefined);
  });

  if (editing && query.isPending) {
    return (
      <div className="max-w-[880px] space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" rounded="lg" />
      </div>
    );
  }

  if (editing && query.isError) {
    return (
      <ErrorState
        error={query.error}
        title="That catalogue entry did not load"
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  const isRecurring = form.watch('isRecurring');

  return (
    <>
      <PageHeader
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Settings', to: '/settings/firm' },
              { label: 'Catalogue', to: '/settings/catalogue' },
              { label: editing ? (query.data?.name ?? 'Entry') : 'Add entry' },
            ]}
          />
        }
        title={editing ? `Edit ${query.data?.name ?? 'entry'}` : 'Add a catalogue entry'}
        description="Due-date rules are data, not code. Change one here and future generation follows it."
      />
      <SettingsNav />

      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        className="max-w-[880px] space-y-4"
        noValidate
      >
        <Card>
          <Fieldset legend="Basics">
            <FieldRow>
              <FormField label="Name" required error={form.formState.errors.name?.message}>
                {({ inputId, describedBy, invalid }) => (
                  <Input
                    id={inputId}
                    invalid={invalid}
                    aria-describedby={describedBy}
                    placeholder="GSTR-3B monthly"
                    {...form.register('name')}
                  />
                )}
              </FormField>

              <FormField
                label="Code"
                required
                helper={editing ? 'The code is fixed after creation.' : 'Uppercase, unique, stable.'}
                error={form.formState.errors.code?.message}
              >
                {({ inputId, describedBy, invalid }) => (
                  <Input
                    id={inputId}
                    readOnly={editing}
                    className="numeric uppercase"
                    invalid={invalid}
                    aria-describedby={describedBy}
                    placeholder="GSTR3B_M"
                    {...form.register('code')}
                  />
                )}
              </FormField>
            </FieldRow>

            <FieldRow>
              <FormField label="Category" required>
                {({ inputId }) => (
                  <Select
                    id={inputId}
                    ariaLabel="Category"
                    value={form.watch('category')}
                    onValueChange={(value) => {
                      form.setValue('category', value as ComplianceTypeFormValues['category'], {
                        shouldDirty: true,
                      });
                    }}
                    options={COMPLIANCE_CATEGORIES.map((category) => ({
                      value: category,
                      label: CATEGORY_LABELS[category],
                    }))}
                  />
                )}
              </FormField>

              <FormField label="Default frequency" required>
                {({ inputId }) => (
                  <Select
                    id={inputId}
                    ariaLabel="Default frequency"
                    disabled={!isRecurring}
                    value={form.watch('defaultFrequency')}
                    onValueChange={(value) => {
                      form.setValue(
                        'defaultFrequency',
                        value as ComplianceTypeFormValues['defaultFrequency'],
                        { shouldDirty: true },
                      );
                    }}
                    options={FREQUENCIES.map((frequency) => ({
                      value: frequency,
                      label: FREQUENCY_LABELS[frequency],
                    }))}
                  />
                )}
              </FormField>
            </FieldRow>

            <Checkbox
              checked={isRecurring}
              label="This filing recurs"
              description="Recurring entries need a due-date rule so periods can be generated."
              onCheckedChange={(checked) => {
                form.setValue('isRecurring', checked, { shouldDirty: true });
              }}
            />

            <Checkbox
              checked={form.watch('active')}
              label="Active"
              description="Inactive entries stay linked to history but generate nothing new."
              onCheckedChange={(checked) => {
                form.setValue('active', checked, { shouldDirty: true });
              }}
            />
          </Fieldset>
        </Card>

        {isRecurring ? (
          <Card>
            <CardHeader title="Due-date rule" />
            <DueDateRuleEditor form={form} />
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Reminder offsets" />
          <FormField
            label="Days before the due date"
            helper="Comma separated, up to six. Staff assigned the filing are emailed on each."
            error={form.formState.errors.reminderOffsetsDays?.message}
          >
            {({ inputId, describedBy, invalid }) => (
              <Input
                id={inputId}
                className="numeric"
                invalid={invalid}
                aria-describedby={describedBy}
                {...form.register('reminderOffsetsDays')}
              />
            )}
          </FormField>
        </Card>

        <Card>
          <CardHeader title="Default document checklist" />
          <ChecklistEditor form={form} fields={checklist} />
        </Card>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              void navigate('/settings/catalogue');
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={mutation.isPending}
            loadingLabel="Saving this entry"
          >
            {editing ? 'Save entry' : 'Add entry'}
          </Button>
        </div>
      </form>
    </>
  );
}
