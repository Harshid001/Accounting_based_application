import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';

import {
  activateUser,
  deactivateUser,
  getUser,
  setUserRole,
  updateUser,
} from '@/api/users.api';
import { queryKeys } from '@/api/queryKeys';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, DefinitionList } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { FieldRow, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { UserStatusPill } from '@/components/domain/StatusPills';
import { LinkedClientsEditor } from '@/routes/settings/components/LinkedClientsEditor';
import { SettingsNav } from '@/routes/settings/components/SettingsNav';
import { useConfirm } from '@/hooks/useConfirm';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useCurrentUser } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { ROLE_LABELS } from '@/lib/constants';
import { formatDateTime } from '@/lib/date';
import { fieldErrorMap, normaliseError } from '@/lib/errors';
import { adminUserSchema } from '@/schemas/user.schema';
import type { AdminUserValues } from '@/schemas/user.schema';
import { ROLES } from '@/types/enums';
import type { Role } from '@/types/enums';

export function UserDetail() {
  const { userId = '' } = useParams();
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  const { success, errorToast } = useToast();
  const confirm = useConfirm();

  const query = useQuery({
    queryKey: queryKeys.users.detail(userId),
    queryFn: () => getUser(userId),
    enabled: userId.length > 0,
  });

  usePageTitle(query.data?.name ?? 'User');

  const form = useForm<AdminUserValues>({
    resolver: zodResolver(adminUserSchema),
    defaultValues: { name: '', phone: '' },
  });

  useEffect(() => {
    if (query.data === undefined) return;
    form.reset({ name: query.data.name, phone: query.data.phone ?? '' });
  }, [query.data, form]);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
  };

  const save = useMutation({
    mutationFn: (values: AdminUserValues) =>
      updateUser(userId, {
        name: values.name,
        phone: values.phone.trim().length === 0 ? null : values.phone.trim(),
      }),
    onSuccess: () => {
      invalidate();
      success('Account saved');
    },
    onError: (error: unknown) => {
      const normalised = normaliseError(error);
      for (const [field, message] of Object.entries(fieldErrorMap(normalised))) {
        form.setError(field as keyof AdminUserValues, { type: 'server', message });
      }
    },
  });

  const role = useMutation({
    mutationFn: (next: Role) => setUserRole(userId, next),
    onSuccess: (user) => {
      invalidate();
      success('Role changed', `${user.name} is now ${ROLE_LABELS[user.role].toLowerCase()}.`);
    },
    onError: (error: unknown) => {
      errorToast(error, 'That role change did not save');
    },
  });

  const activation = useMutation({
    mutationFn: (active: boolean) => (active ? activateUser(userId) : deactivateUser(userId)),
    onSuccess: (_user, active) => {
      invalidate();
      success(
        active ? 'Account reactivated' : 'Account deactivated',
        active ? undefined : 'Their sessions were ended immediately.',
      );
    },
    onError: (error: unknown) => {
      errorToast(error, 'That change did not save');
    },
  });

  if (query.isPending) {
    return (
      <div className="max-w-[880px] space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" rounded="lg" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        title="That account did not load"
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  const user = query.data;
  const isSelf = user.id === me.id;

  const submit = form.handleSubmit(async (values) => {
    await save.mutateAsync(values).catch(() => undefined);
  });

  return (
    <>
      <PageHeader
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Settings', to: '/settings/firm' },
              { label: 'Users', to: '/settings/users' },
              { label: user.name },
            ]}
          />
        }
        title={user.name}
        description={user.email}
      />
      <SettingsNav />

      <div className="max-w-[880px] space-y-4">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={user.name} image={user.image} size="lg" />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge tone={user.role === 'admin' ? 'accent' : 'neutral'}>
                    {ROLE_LABELS[user.role]}
                  </Badge>
                  <UserStatusPill status={user.status} />
                  {user.emailVerified ? null : <Badge tone="waiting">Email unverified</Badge>}
                </p>
              </div>
            </div>

            <Button
              variant={user.status === 'active' ? 'danger' : 'secondary'}
              size="sm"
              disabled={isSelf}
              title={isSelf ? 'You cannot deactivate your own account.' : undefined}
              onClick={() => {
                confirm.ask({
                  title:
                    user.status === 'active'
                      ? `Deactivate ${user.name}?`
                      : `Reactivate ${user.name}?`,
                  body:
                    user.status === 'active'
                      ? 'Their sessions end immediately and they cannot sign in until you reactivate them.'
                      : 'They will be able to sign in again straight away.',
                  confirmLabel: user.status === 'active' ? 'Deactivate' : 'Reactivate',
                  destructive: user.status === 'active',
                  onConfirm: async () => {
                    await activation.mutateAsync(user.status !== 'active').catch(() => undefined);
                  },
                });
              }}
            >
              {user.status === 'active' ? 'Deactivate' : 'Reactivate'}
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Details" />
          <form
            onSubmit={(event) => {
              void submit(event);
            }}
            className="space-y-4"
            noValidate
          >
            <FieldRow>
              <FormField label="Full name" required error={form.formState.errors.name?.message}>
                {({ inputId, describedBy, invalid }) => (
                  <Input
                    id={inputId}
                    invalid={invalid}
                    aria-describedby={describedBy}
                    {...form.register('name')}
                  />
                )}
              </FormField>
              <FormField label="Mobile" error={form.formState.errors.phone?.message}>
                {({ inputId, describedBy, invalid }) => (
                  <Input
                    id={inputId}
                    className="numeric"
                    invalid={invalid}
                    aria-describedby={describedBy}
                    {...form.register('phone')}
                  />
                )}
              </FormField>
            </FieldRow>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={save.isPending}
                loadingLabel="Saving this account"
              >
                Save details
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="Role"
            description="Promoting to staff or admin clears every linked client record."
          />
          <div className="max-w-xs">
            <Select
              ariaLabel="Role"
              value={user.role}
              disabled={isSelf || role.isPending}
              onValueChange={(next) => {
                confirm.ask({
                  title: `Change ${user.name} to ${ROLE_LABELS[next as Role]}?`,
                  body:
                    next === 'client'
                      ? 'They lose firm-wide access immediately and will need client records linked before they see anything.'
                      : 'Their linked client records are cleared and they gain access across the firm.',
                  confirmLabel: 'Change role',
                  onConfirm: async () => {
                    await role.mutateAsync(next as Role).catch(() => undefined);
                  },
                });
              }}
              options={ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }))}
            />
            {isSelf ? (
              <p className="mt-1 text-xs text-[var(--fd-text-tertiary)]">
                You cannot change your own role.
              </p>
            ) : null}
          </div>
        </Card>

        {user.role === 'client' ? (
          <LinkedClientsEditor userId={user.id} linked={user.linkedClients} />
        ) : null}

        <Card>
          <CardHeader title="Account history" />
          <DefinitionList
            items={[
              { label: 'Created', value: formatDateTime(user.createdAt) },
              {
                label: 'Last seen',
                value: user.lastSeenAt === null ? 'Never' : formatDateTime(user.lastSeenAt),
              },
            ]}
          />
        </Card>
      </div>

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
    </>
  );
}
