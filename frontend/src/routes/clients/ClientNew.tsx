import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { createClient } from '@/api/clients.api';
import { queryKeys } from '@/api/queryKeys';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { PageHeader } from '@/components/ui/page-header';
import { ClientForm } from '@/routes/clients/components/ClientForm';
import { useToast } from '@/context/ToastContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { fieldErrorMap, normaliseError } from '@/lib/errors';
import { toClientPayload } from '@/schemas/client.schema';
import type { ClientFormValues } from '@/schemas/client.schema';

export function ClientNew() {
  usePageTitle('Add a client');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: createClient,
    onSuccess: (client) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      success('Client added', `${client.displayName} is on the list.`);
      void navigate(`/clients/${client.id}/profile`, { replace: true });
    },
    onError: (error: unknown) => {
      const normalised = normaliseError(error);
      setFormError(normalised.message);
      setFieldErrors(fieldErrorMap(normalised));
    },
  });

  const submit = async (values: ClientFormValues): Promise<void> => {
    setFormError(null);
    setFieldErrors({});
    await mutation
      .mutateAsync(toClientPayload(values, { includePrivileged: true, includeType: true }))
      .catch(() => undefined);
  };

  return (
    <>
      <PageHeader
        breadcrumb={
          <Breadcrumb items={[{ label: 'Clients', to: '/clients' }, { label: 'Add a client' }]} />
        }
        title="Add a client"
        description="Only the display name and a primary contact are required. Everything else can follow."
      />

      <ClientForm
        mode="create"
        canEditPrivileged
        submitLabel="Add client"
        formError={formError}
        fieldErrors={fieldErrors}
        onSubmit={submit}
        onCancel={() => {
          void navigate('/clients');
        }}
      />
    </>
  );
}
