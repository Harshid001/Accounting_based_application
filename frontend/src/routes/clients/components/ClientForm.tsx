import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldRow, Fieldset, FormField } from '@/components/ui/form-field';
import { InlineError } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { RadioGroup } from '@/components/ui/radio-group';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ClientTypeFieldset } from '@/components/domain/ClientTypeFieldset';
import { StaffMultiPicker } from '@/components/domain/StaffPicker';
import {
  AdditionalContacts,
  ContactFields,
} from '@/routes/clients/components/ContactFields';
import type { ContactErrors } from '@/routes/clients/components/ContactFields';
import { CLIENT_STATUS_LABELS, CLIENT_TYPE_LABELS } from '@/lib/constants';
import { clientSchema, emptyClient, emptyContact } from '@/schemas/client.schema';
import type { ClientFormValues } from '@/schemas/client.schema';
import { CLIENT_STATUSES } from '@/types/enums';

export interface ClientFormProps {
  mode: 'create' | 'edit';
  defaults?: ClientFormValues;
  canEditPrivileged: boolean;
  aadhaarOnFile?: boolean;
  submitLabel: string;
  formError: string | null;
  fieldErrors: Record<string, string>;
  onSubmit: (values: ClientFormValues) => Promise<void>;
  onCancel: () => void;
}

export function ClientForm({
  mode,
  defaults,
  canEditPrivileged,
  aadhaarOnFile = false,
  submitLabel,
  formError,
  fieldErrors,
  onSubmit,
  onCancel,
}: ClientFormProps) {
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: defaults ?? emptyClient,
    mode: 'onBlur',
  });

  const contacts = useFieldArray({ control: form.control, name: 'additionalContacts' });
  const clientType = form.watch('clientType');
  const readOnlyPrivileged = !canEditPrivileged;

  useEffect(() => {
    for (const [field, message] of Object.entries(fieldErrors)) {
      form.setError(field as keyof ClientFormValues, { type: 'server', message });
    }
    const first = Object.keys(fieldErrors)[0];
    if (first !== undefined) {
      const element = document.querySelector<HTMLElement>(`[name="${first}"]`);
      element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      element?.focus({ preventScroll: true });
    }
  }, [fieldErrors, form]);

  const submit = form.handleSubmit(
    async (values) => {
      await onSubmit(values);
    },
    (errors) => {
      const firstKey = Object.keys(errors)[0];
      if (firstKey === undefined) return;
      const element = document.querySelector<HTMLElement>(`[name^="${firstKey}"]`);
      element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      element?.focus({ preventScroll: true });
    },
  );

  const additionalErrorAt = (index: number): ContactErrors | undefined => {
    const list = form.formState.errors.additionalContacts;
    return Array.isArray(list) ? (list[index] as ContactErrors | undefined) : undefined;
  };

  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      className="max-w-[880px] space-y-5"
      noValidate
    >
      {formError === null ? null : <InlineError message={formError} />}

      <Card>
        <Fieldset legend="Basics">
          {mode === 'create' ? (
            <RadioGroup
              legend="What kind of client is this?"
              orientation="horizontal"
              value={clientType}
              onValueChange={(value) => {
                form.setValue('clientType', value as ClientFormValues['clientType'], {
                  shouldDirty: true,
                });
              }}
              options={[
                {
                  value: 'business',
                  label: CLIENT_TYPE_LABELS.business,
                  description: 'GSTIN, TAN, CIN and an entity type.',
                },
                {
                  value: 'individual',
                  label: CLIENT_TYPE_LABELS.individual,
                  description: 'PAN, Aadhaar and a date of birth.',
                },
              ]}
            />
          ) : (
            <p className="text-xs text-[var(--fd-text-tertiary)]">
              This is {CLIENT_TYPE_LABELS[clientType].toLowerCase()} record. A client cannot change
              between individual and business after it is created.
            </p>
          )}

          <FieldRow>
            <FormField
              label="Display name"
              required
              helper="What everyone at the firm calls this client."
              error={form.formState.errors.displayName?.message}
            >
              {({ inputId, describedBy, invalid }) => (
                <Input
                  id={inputId}
                  invalid={invalid}
                  aria-describedby={describedBy}
                  {...form.register('displayName')}
                />
              )}
            </FormField>

            <FormField
              label="Legal name"
              helper="As it appears on the PAN card or certificate of incorporation."
              error={form.formState.errors.legalName?.message}
            >
              {({ inputId, describedBy, invalid }) => (
                <Input
                  id={inputId}
                  invalid={invalid}
                  aria-describedby={describedBy}
                  {...form.register('legalName')}
                />
              )}
            </FormField>
          </FieldRow>

          <FormField
            label="Status"
            helper={readOnlyPrivileged ? 'Only an administrator can change the status.' : undefined}
          >
            {({ inputId, describedBy }) => (
              <Select
                id={inputId}
                ariaDescribedBy={describedBy}
                ariaLabel="Status"
                disabled={readOnlyPrivileged}
                value={form.watch('status')}
                onValueChange={(value) => {
                  form.setValue('status', value as ClientFormValues['status'], {
                    shouldDirty: true,
                  });
                }}
                options={CLIENT_STATUSES.map((status) => ({
                  value: status,
                  label: CLIENT_STATUS_LABELS[status],
                }))}
              />
            )}
          </FormField>
        </Fieldset>
      </Card>

      <Card>
        <ClientTypeFieldset
          form={form}
          clientType={clientType}
          readOnly={readOnlyPrivileged}
          aadhaarOnFile={aadhaarOnFile}
        />
        {readOnlyPrivileged ? (
          <p className="mt-3 text-xs text-[var(--fd-text-tertiary)]">
            Statutory identifiers are administrator-only. Ask an administrator if one needs
            correcting.
          </p>
        ) : null}
      </Card>

      <Card>
        <ContactFields<ClientFormValues>
          legend="Primary contact"
          description="The person the firm actually calls."
          register={form.register}
          readOnly={false}
          errors={form.formState.errors.primaryContact}
          paths={{
            name: 'primaryContact.name',
            role: 'primaryContact.role',
            email: 'primaryContact.email',
            phone: 'primaryContact.phone',
          }}
        />
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-[var(--fd-text-primary)]">
          Additional contacts
        </h2>
        <AdditionalContacts<ClientFormValues>
          contacts={form.watch('additionalContacts')}
          register={form.register}
          readOnly={false}
          errorAt={additionalErrorAt}
          pathsFor={(index) => ({
            name: `additionalContacts.${index}.name`,
            role: `additionalContacts.${index}.role`,
            email: `additionalContacts.${index}.email`,
            phone: `additionalContacts.${index}.phone`,
          })}
          onAdd={() => {
            contacts.append(emptyContact);
          }}
          onRemove={(index) => {
            contacts.remove(index);
          }}
        />
      </Card>

      <Card>
        <Fieldset legend="Address">
          <FormField label="Address line 1" error={form.formState.errors.address?.line1?.message}>
            {({ inputId, describedBy, invalid }) => (
              <Input
                id={inputId}
                invalid={invalid}
                aria-describedby={describedBy}
                {...form.register('address.line1')}
              />
            )}
          </FormField>
          <FormField label="Address line 2" error={form.formState.errors.address?.line2?.message}>
            {({ inputId, describedBy, invalid }) => (
              <Input
                id={inputId}
                invalid={invalid}
                aria-describedby={describedBy}
                {...form.register('address.line2')}
              />
            )}
          </FormField>
          <FieldRow>
            <FormField label="City" error={form.formState.errors.address?.city?.message}>
              {({ inputId, describedBy, invalid }) => (
                <Input
                  id={inputId}
                  invalid={invalid}
                  aria-describedby={describedBy}
                  {...form.register('address.city')}
                />
              )}
            </FormField>
            <FormField label="Pincode" error={form.formState.errors.address?.pincode?.message}>
              {({ inputId, describedBy, invalid }) => (
                <Input
                  id={inputId}
                  inputMode="numeric"
                  className="numeric"
                  invalid={invalid}
                  aria-describedby={describedBy}
                  {...form.register('address.pincode')}
                />
              )}
            </FormField>
          </FieldRow>
          <FormField label="State" error={form.formState.errors.address?.state?.message}>
            {({ inputId, describedBy, invalid }) => (
              <Input
                id={inputId}
                invalid={invalid}
                aria-describedby={describedBy}
                {...form.register('address.state')}
              />
            )}
          </FormField>
        </Fieldset>
      </Card>

      {canEditPrivileged ? (
        <Card>
          <StaffMultiPicker
            legend="Who at the firm works on this client?"
            value={form.watch('assignedStaff')}
            onChange={(next) => {
              form.setValue('assignedStaff', next, { shouldDirty: true });
            }}
          />
        </Card>
      ) : null}

      <Card>
        <FormField
          label="Internal notes"
          helper="Never shown in the client portal."
          error={form.formState.errors.notes?.message}
        >
          {({ inputId, describedBy, invalid }) => (
            <Textarea
              id={inputId}
              rows={4}
              invalid={invalid}
              aria-describedby={describedBy}
              {...form.register('notes')}
            />
          )}
        </FormField>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={form.formState.isSubmitting}
          loadingLabel="Saving this client"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
