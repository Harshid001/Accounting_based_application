import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  createClientService,
  deleteClientService,
  listClientServices,
} from '@/api/clientServices.api';
import { listComplianceTypes } from '@/api/complianceTypes.api';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { IconButton } from '@/components/ui/icon-button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StaffPicker } from '@/components/domain/StaffPicker';
import { useClientRecord } from '@/routes/clients/ClientRecord';
import { useConfirm } from '@/hooks/useConfirm';
import { useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { CATEGORY_LABELS, FREQUENCY_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/date';
import {
  clientServiceSchema,
  emptyClientService,
  toClientServicePayload,
} from '@/schemas/clientService.schema';
import type { ClientServiceValues } from '@/schemas/clientService.schema';
import { FREQUENCIES } from '@/types/enums';

export function ServicesPanel() {
  const { clientId, client, readOnly } = useClientRecord();
  const queryClient = useQueryClient();
  const { allows } = useSession();
  const { success, errorToast } = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);

  const services = useQuery({
    queryKey: queryKeys.clients.services(clientId),
    queryFn: () => listClientServices(clientId),
  });

  const catalogue = useQuery({
    queryKey: queryKeys.complianceTypes.list({ active: 'true' }),
    queryFn: () => listComplianceTypes({ active: 'true' }),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const form = useForm<ClientServiceValues>({
    resolver: zodResolver(clientServiceSchema),
    defaultValues: emptyClientService,
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.clients.services(clientId) });
  };

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => createClientService(clientId, body),
    onSuccess: () => {
      invalidate();
      success('Service added', 'FirmDesk will generate its filings from the next run.');
      setOpen(false);
      form.reset(emptyClientService);
    },
    onError: (error: unknown) => {
      errorToast(error, 'That service was not added');
    },
  });

  const remove = useMutation({
    mutationFn: deleteClientService,
    onSuccess: () => {
      invalidate();
      success('Service removed');
    },
    onError: (error: unknown) => {
      errorToast(error, 'That service was not removed');
    },
  });

  const submit = form.handleSubmit(async (values) => {
    await create
      .mutateAsync(toClientServicePayload(values, { includeType: true }))
      .catch(() => undefined);
  });

  const canWrite = allows('client_service:write') && !readOnly;

  return (
    <Card>
      <CardHeader
        title="Services"
        description="What the firm files for this client, and how often."
        actions={
          canWrite ? (
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Plus size={14} aria-hidden="true" />}
              onClick={() => {
                setOpen(true);
              }}
            >
              Add service
            </Button>
          ) : undefined
        }
      />

      {services.isPending ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-10 w-full" rounded="lg" />
          <Skeleton className="h-10 w-full" rounded="lg" />
        </div>
      ) : services.isError ? (
        <ErrorState
          compact
          error={services.error}
          title="Services did not load"
          onRetry={() => {
            void services.refetch();
          }}
        />
      ) : services.data.length === 0 ? (
        <EmptyState
          title="No services yet"
          description={`FirmDesk generates filings from services. Add one so ${client.displayName} appears on the calendar.`}
          action={
            canWrite ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setOpen(true);
                }}
              >
                Add service
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--fd-border-subtle)]">
          {services.data.map((service) => (
            <li key={service.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-base font-medium text-[var(--fd-text-primary)]">
                  {service.complianceType?.name ?? 'Unknown filing'}
                  {service.complianceType === null ? null : (
                    <Badge tone="neutral">
                      {CATEGORY_LABELS[service.complianceType.category]}
                    </Badge>
                  )}
                  {service.active ? null : <Badge tone="muted">Inactive</Badge>}
                </p>
                <p className="text-2xs text-[var(--fd-text-tertiary)]">
                  {service.frequency === null
                    ? 'Catalogue default frequency'
                    : FREQUENCY_LABELS[service.frequency]}
                  {' · from '}
                  {formatDate(service.startDate)}
                  {service.endDate === null ? '' : ` to ${formatDate(service.endDate)}`}
                  {service.assignedStaff === null
                    ? ''
                    : ` · ${service.assignedStaff.name}`}
                </p>
              </div>

              {allows('client_service:delete') && !readOnly ? (
                <IconButton
                  label={`Remove ${service.complianceType?.name ?? 'this service'}`}
                  size="sm"
                  icon={<Trash2 size={14} aria-hidden="true" />}
                  onClick={() => {
                    confirm.ask({
                      title: 'Remove this service?',
                      body: 'Filings that already exist stay. Only future generation stops. If it has already generated filings, deactivate it instead.',
                      confirmLabel: 'Remove service',
                      destructive: true,
                      onConfirm: () => remove.mutateAsync(service.id),
                    });
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Add a service"
        description="Link this client to a catalogue entry so filings generate automatically."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={create.isPending}
              loadingLabel="Adding this service"
              onClick={() => {
                void submit();
              }}
            >
              Add service
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField
            label="Filing"
            required
            error={form.formState.errors.complianceTypeId?.message}
          >
            {({ inputId, describedBy, invalid }) => (
              <Select
                id={inputId}
                invalid={invalid}
                ariaDescribedBy={describedBy}
                ariaLabel="Filing"
                value={form.watch('complianceTypeId')}
                onValueChange={(value) => {
                  form.setValue('complianceTypeId', value, { shouldValidate: true });
                }}
                options={(catalogue.data ?? []).map((type) => ({
                  value: type.id,
                  label: `${type.name} (${CATEGORY_LABELS[type.category]})`,
                }))}
              />
            )}
          </FormField>

          <FormField
            label="Frequency override"
            helper="Leave blank to follow the catalogue default."
          >
            {({ inputId, describedBy }) => (
              <Select
                id={inputId}
                ariaDescribedBy={describedBy}
                ariaLabel="Frequency override"
                value={form.watch('frequency')}
                onValueChange={(value) => {
                  form.setValue('frequency', value as ClientServiceValues['frequency']);
                }}
                options={FREQUENCIES.map((frequency) => ({
                  value: frequency,
                  label: FREQUENCY_LABELS[frequency],
                }))}
              />
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Start date" required error={form.formState.errors.startDate?.message}>
              {({ inputId, describedBy, invalid }) => (
                <Controller
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <DatePicker
                      id={inputId}
                      ariaLabel="Start date"
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

            <FormField label="End date" error={form.formState.errors.endDate?.message}>
              {({ inputId, describedBy, invalid }) => (
                <Controller
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <DatePicker
                      id={inputId}
                      ariaLabel="End date"
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

          <FormField
            label="Who handles it"
            helper="They must already be assigned to this client."
          >
            {({ inputId, describedBy }) => (
              <StaffPicker
                id={inputId}
                ariaDescribedBy={describedBy}
                restrictTo={client.assignedStaff.map((person) => person.id)}
                value={
                  form.watch('assignedStaff').length === 0 ? null : form.watch('assignedStaff')
                }
                onChange={(value) => {
                  form.setValue('assignedStaff', value ?? '');
                }}
              />
            )}
          </FormField>
        </div>
      </Dialog>

      {confirm.request === null ? null : (
        <ConfirmDialog
          open={confirm.open}
          onOpenChange={confirm.setOpen}
          title={confirm.request.title}
          body={confirm.request.body}
          confirmLabel={confirm.request.confirmLabel}
          destructive={confirm.request.destructive ?? false}
          pending={confirm.pending}
          onConfirm={confirm.confirm}
        />
      )}
    </Card>
  );
}
