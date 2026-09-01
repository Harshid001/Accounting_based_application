import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import { fetchPortalProfile, updatePortalProfile } from '@/api/portal.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, DefinitionList } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { FieldRow, Fieldset, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AdditionalContacts,
  ContactFields,
} from '@/routes/clients/components/ContactFields';
import type { ContactErrors } from '@/routes/clients/components/ContactFields';
import { OwnAadhaar } from '@/routes/portal/components/OwnAadhaar';
import { useActiveClient } from '@/context/ActiveClientContext';
import { useToast } from '@/context/ToastContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { CLIENT_TYPE_LABELS, ENTITY_TYPE_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/date';
import { fieldErrorMap, normaliseError } from '@/lib/errors';
import { emptyContact } from '@/schemas/client.schema';
import { portalProfileSchema, toPortalProfilePayload } from '@/schemas/profile.schema';
import type { PortalProfileValues } from '@/schemas/profile.schema';
import type { Contact } from '@/types/models';

const toContactValues = (contact: Contact) => ({
  name: contact.name,
  role: contact.role ?? '',
  email: contact.email,
  phone: contact.phone ?? '',
});

const EMPTY: PortalProfileValues = {
  primaryContact: emptyContact,
  additionalContacts: [],
  address: { line1: '', line2: '', city: '', state: '', pincode: '' },
};

export function PortalProfile() {
  usePageTitle('Your details');
  const { activeClientId } = useActiveClient();
  const clientId = activeClientId ?? '';
  const queryClient = useQueryClient();
  const { success } = useToast();

  const query = useQuery({
    queryKey: queryKeys.portal.profile(clientId),
    queryFn: fetchPortalProfile,
    enabled: clientId.length > 0,
  });

  const form = useForm<PortalProfileValues>({
    resolver: zodResolver(portalProfileSchema),
    defaultValues: EMPTY,
  });

  const contacts = useFieldArray({ control: form.control, name: 'additionalContacts' });

  useEffect(() => {
    const profile = query.data;
    if (profile === undefined) return;
    form.reset({
      primaryContact: toContactValues(profile.primaryContact),
      additionalContacts: profile.additionalContacts.map(toContactValues),
      address: {
        line1: profile.address?.line1 ?? '',
        line2: profile.address?.line2 ?? '',
        city: profile.address?.city ?? '',
        state: profile.address?.state ?? '',
        pincode: profile.address?.pincode ?? '',
      },
    });
  }, [query.data, form]);

  const mutation = useMutation({
    mutationFn: (values: PortalProfileValues) =>
      updatePortalProfile(toPortalProfilePayload(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.portal.all });
      success('Details saved', 'Your firm can see the change straight away.');
    },
    onError: (error: unknown) => {
      const normalised = normaliseError(error);
      for (const [field, message] of Object.entries(fieldErrorMap(normalised))) {
        form.setError(field as keyof PortalProfileValues, { type: 'server', message });
      }
    },
  });

  const submit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync(values).catch(() => undefined);
  });

  if (query.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" rounded="lg" />
        <Skeleton className="h-64 w-full" rounded="lg" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        title="Your details did not load"
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  const profile = query.data;

  const additionalErrorAt = (index: number): ContactErrors | undefined => {
    const list = form.formState.errors.additionalContacts;
    return Array.isArray(list) ? (list[index] as ContactErrors | undefined) : undefined;
  };

  return (
    <>
      <PageHeader
        title="Your details"
        description="Keep your contact details current. Statutory identifiers are managed by your firm."
      />

      <div className="space-y-4">
        <Card>
          <CardHeader
            title="On record with your firm"
            description="If any of these are wrong, message your firm and they will correct them."
          />
          <DefinitionList
            items={[
              { label: 'Name', value: profile.displayName },
              { label: 'Legal name', value: profile.legalName ?? '—' },
              { label: 'Type', value: CLIENT_TYPE_LABELS[profile.clientType] },
              { label: 'PAN', value: <span className="numeric">{profile.pan ?? '—'}</span> },
              ...(profile.clientType === 'business'
                ? [
                    {
                      label: 'GSTIN',
                      value: <span className="numeric">{profile.gstin ?? '—'}</span>,
                    },
                    { label: 'TAN', value: <span className="numeric">{profile.tan ?? '—'}</span> },
                    { label: 'CIN', value: <span className="numeric">{profile.cin ?? '—'}</span> },
                    {
                      label: 'Entity type',
                      value:
                        profile.entityType === null
                          ? '—'
                          : ENTITY_TYPE_LABELS[profile.entityType],
                    },
                    {
                      label: 'Incorporated',
                      value: formatDate(profile.incorporationDate),
                    },
                  ]
                : [
                    { label: 'Date of birth', value: formatDate(profile.dateOfBirth) },
                    {
                      label: 'Aadhaar',
                      value: <OwnAadhaar present={profile.aadhaarPresent} />,
                    },
                  ]),
            ]}
          />
        </Card>

        <form
          onSubmit={(event) => {
            void submit(event);
          }}
          className="space-y-4"
          noValidate
        >
          <Card>
            <ContactFields<PortalProfileValues>
              legend="Main contact"
              description="Who your firm should call first."
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
              Other contacts
            </h2>
            <AdditionalContacts<PortalProfileValues>
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

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              loading={mutation.isPending}
              loadingLabel="Saving your details"
            >
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
