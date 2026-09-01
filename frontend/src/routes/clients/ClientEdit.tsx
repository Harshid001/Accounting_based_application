import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getClient, updateClient } from '@/api/clients.api';
import { queryKeys } from '@/api/queryKeys';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientForm } from '@/routes/clients/components/ClientForm';
import { clientToFormValues } from '@/routes/clients/clientFormValues';
import { useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { fieldErrorMap, normaliseError } from '@/lib/errors';
import { toClientPayload } from '@/schemas/client.schema';
import type { ClientFormValues } from '@/schemas/client.schema';

export function ClientEdit() {
  const { clientId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { allows } = useSession();
  const { success } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const query = useQuery({
    queryKey: queryKeys.clients.detail(clientId),
    queryFn: () => getClient(clientId),
    enabled: clientId.length > 0,
  });

  usePageTitle(query.data === undefined ? 'Edit client' : `Edit ${query.data.displayName}`);

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => updateClient(clientId, body),
    onSuccess: (client) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      success('Client updated', `${client.displayName} has been saved.`);
      void navigate(`/clients/${clientId}/profile`);
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
      .mutateAsync(
        toClientPayload(values, {
          includePrivileged: allows('client:update_privileged'),
          includeType: false,
        }),
      )
      .catch(() => undefined);
  };

  if (query.isPending) {
    return (
      <div className="max-w-[880px] space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" rounded="lg" />
        <Skeleton className="h-48 w-full" rounded="lg" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        title="That client did not load"
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  return (
    <>
      <PageHeader
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Clients', to: '/clients' },
              { label: query.data.displayName, to: `/clients/${clientId}/profile` },
              { label: 'Edit' },
            ]}
          />
        }
        title={`Edit ${query.data.displayName}`}
        description={
          allows('client:update_privileged')
            ? 'Statutory identifiers and assignment are editable here.'
            : 'You can edit contact details, address and notes. Identifiers are administrator-only.'
        }
      />

      <ClientForm
        mode="edit"
        defaults={clientToFormValues(query.data)}
        canEditPrivileged={allows('client:update_privileged')}
        aadhaarOnFile={query.data.aadhaarPresent === true}
        submitLabel="Save changes"
        formError={formError}
        fieldErrors={fieldErrors}
        onSubmit={submit}
        onCancel={() => {
          void navigate(`/clients/${clientId}/profile`);
        }}
      />
    </>
  );
}
