import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { listUsers, purgeUnlinkedAccounts } from '@/api/users.api';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { DataTable } from '@/components/ui/table';
import type { TableColumn } from '@/components/ui/table';
import { SettingsNav } from '@/routes/settings/components/SettingsNav';
import { useConfirm } from '@/hooks/useConfirm';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/context/ToastContext';
import { formatDateTime, relativeTime } from '@/lib/date';
import { pluralise } from '@/lib/format';
import { purgeSchema } from '@/schemas/user.schema';
import type { PurgeValues } from '@/schemas/user.schema';
import type { AdminUser } from '@/types/models';

export function UnlinkedAccounts() {
  usePageTitle('Unlinked accounts');
  const queryClient = useQueryClient();
  const { success, errorToast } = useToast();
  const confirm = useConfirm();

  const params = useListParams({ filterKeys: [], defaultLimit: 25 });
  const listQuery = { page: params.page, limit: params.limit, role: 'client', unlinked: 'true' };

  const query = useQuery({
    queryKey: queryKeys.users.list(listQuery),
    queryFn: () => listUsers(listQuery),
    staleTime: 30_000,
  });

  const form = useForm<PurgeValues>({
    resolver: zodResolver(purgeSchema),
    defaultValues: { olderThanDays: '30' },
  });

  const purge = useMutation({
    mutationFn: (days: number) => purgeUnlinkedAccounts(days),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      success(
        'Purge finished',
        result.deleted === 0
          ? 'Nothing matched, so nothing was deleted.'
          : `Deleted ${pluralise(result.deleted, 'account')}.`,
      );
    },
    onError: (error: unknown) => {
      errorToast(error, 'That purge did not run');
    },
  });

  const columns: Array<TableColumn<AdminUser>> = [
    {
      id: 'name',
      header: 'Account',
      cell: (row) => (
        <span className="min-w-0">
          <Link
            to={`/settings/users/${row.id}`}
            className="block truncate rounded-sm font-medium text-[var(--fd-text-primary)] hover:underline"
          >
            {row.name}
          </Link>
          <span className="text-2xs block truncate text-[var(--fd-text-tertiary)]">
            {row.email}
          </span>
        </span>
      ),
    },
    {
      id: 'verified',
      header: 'Email',
      cell: (row) =>
        row.emailVerified ? (
          <Badge tone="done">Verified</Badge>
        ) : (
          <Badge tone="waiting">Unverified</Badge>
        ),
    },
    {
      id: 'created',
      header: 'Signed up',
      align: 'right',
      cell: (row) => (
        <span className="numeric" title={formatDateTime(row.createdAt)}>
          {relativeTime(row.createdAt)}
        </span>
      ),
    },
    {
      id: 'action',
      header: 'Next step',
      hideBelow: 'md',
      cell: (row) => (
        <Link
          to={`/settings/users/${row.id}`}
          className="rounded-sm text-[var(--fd-accent)] hover:underline"
        >
          Link a client record
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Unlinked accounts"
        description="Anyone can sign up. These accounts exist but can reach nothing until you link them."
      />
      <SettingsNav />

      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Bulk delete"
            description="Unverified, unlinked client accounts older than the age you set. Verified accounts are never touched here."
          />
          <form
            onSubmit={form.handleSubmit((values) => {
              confirm.ask({
                title: 'Delete old unlinked accounts?',
                body: `Every unverified, unlinked client account older than ${values.olderThanDays} days is deleted permanently. This cannot be undone.`,
                confirmLabel: 'Delete accounts',
                destructive: true,
                typedConfirmation: 'DELETE',
                typedHint: 'Type DELETE to confirm',
                onConfirm: async () => {
                  await purge
                    .mutateAsync(Number.parseInt(values.olderThanDays, 10))
                    .catch(() => undefined);
                },
              });
            })}
            className="flex flex-wrap items-end gap-3"
          >
            <FormField
              label="Older than, in days"
              className="w-48"
              error={form.formState.errors.olderThanDays?.message}
            >
              {({ inputId, describedBy, invalid }) => (
                <Input
                  id={inputId}
                  inputMode="numeric"
                  className="numeric"
                  invalid={invalid}
                  aria-describedby={describedBy}
                  {...form.register('olderThanDays')}
                />
              )}
            </FormField>
            <Button
              type="submit"
              variant="danger"
              size="md"
              loading={purge.isPending}
              loadingLabel="Deleting accounts"
              iconLeft={<Trash2 size={14} aria-hidden="true" />}
            >
              Delete matching accounts
            </Button>
          </form>
        </Card>

        {query.isError ? (
          <ErrorState
            error={query.error}
            title="Unlinked accounts did not load"
            onRetry={() => {
              void query.refetch();
            }}
          />
        ) : (
          <>
            <DataTable
              caption="Unlinked accounts"
              columns={columns}
              rows={query.data?.items ?? []}
              rowKey={(row) => row.id}
              state={query.isPending ? 'loading' : 'ready'}
              emptySlot={
                <EmptyState
                  icon={<ShieldCheck size={20} aria-hidden="true" />}
                  title="Nothing is waiting"
                  description="Every client account has at least one client record linked to it."
                />
              }
            />

            {query.data === undefined || query.data.total === 0 ? null : (
              <Pagination
                page={query.data.page}
                limit={query.data.limit}
                total={query.data.total}
                totalPages={query.data.totalPages}
                onPageChange={params.setPage}
                onLimitChange={params.setLimit}
                label="accounts"
              />
            )}
          </>
        )}
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
          {...(confirm.request.typedConfirmation === undefined
            ? {}
            : { typedConfirmation: confirm.request.typedConfirmation })}
          {...(confirm.request.typedHint === undefined
            ? {}
            : { typedHint: confirm.request.typedHint })}
        />
      )}
    </>
  );
}
