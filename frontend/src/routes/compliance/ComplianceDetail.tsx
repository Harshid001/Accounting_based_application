import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { deleteComplianceItem, getComplianceItem, updateComplianceItem } from '@/api/compliance.api';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, DefinitionList } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { ComplianceStatusPill, OverdueBadge } from '@/components/domain/StatusPills';
import { RequestList } from '@/components/domain/RequestList';
import { StaffPicker } from '@/components/domain/StaffPicker';
import { StatusTransition } from '@/routes/compliance/components/StatusTransition';
import { RequestForm } from '@/routes/requests/components/RequestForm';
import { TaskTable } from '@/routes/tasks/components/TaskTable';
import { useConfirm } from '@/hooks/useConfirm';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { CATEGORY_LABELS, PERIOD_TYPE_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/date';

export function ComplianceDetail() {
  const { complianceId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { allows } = useSession();
  const { success, errorToast } = useToast();
  const confirm = useConfirm();
  const [requestOpen, setRequestOpen] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.compliance.detail(complianceId),
    queryFn: () => getComplianceItem(complianceId),
    enabled: complianceId.length > 0,
  });

  usePageTitle(
    query.data === undefined
      ? 'Filing'
      : `${query.data.complianceType?.name ?? 'Filing'} — ${query.data.periodLabel}`,
  );

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.compliance.all });
  };

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => updateComplianceItem(complianceId, body),
    onSuccess: () => {
      invalidate();
      success('Filing updated');
    },
    onError: (error: unknown) => {
      errorToast(error, 'That change did not save');
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteComplianceItem(complianceId),
    onSuccess: () => {
      invalidate();
      success('Filing deleted');
      void navigate('/compliance', { replace: true });
    },
    onError: (error: unknown) => {
      errorToast(error, 'That filing was not deleted');
    },
  });

  if (query.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-40 w-full" rounded="lg" />
        <Skeleton className="h-32 w-full" rounded="lg" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        title="That filing did not load"
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  const item = query.data;
  const title = `${item.complianceType?.name ?? 'Filing'} — ${item.periodLabel}`;
  const canEdit = allows('compliance:update');

  return (
    <>
      <PageHeader
        breadcrumb={
          <Breadcrumb items={[{ label: 'Filings', to: '/compliance' }, { label: title }]} />
        }
        title={title}
        {...(item.client === null ? {} : { description: item.client.name })}
        meta={
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ComplianceStatusPill status={item.status} />
            <OverdueBadge overdue={item.isOverdue} />
            {item.dueDateOverridden ? <Badge tone="neutral">Due date overridden</Badge> : null}
            <Badge tone="neutral">Generated {item.generatedBy}</Badge>
          </div>
        }
        actions={
          allows('compliance:delete') && item.status === 'pending' ? (
            <Button
              variant="danger"
              size="sm"
              iconLeft={<Trash2 size={14} aria-hidden="true" />}
              onClick={() => {
                confirm.ask({
                  title: `Delete ${title}?`,
                  body: 'Only a pending filing can be deleted. Its document requests stay behind. This cannot be undone.',
                  confirmLabel: 'Delete filing',
                  destructive: true,
                  onConfirm: async () => {
                    await remove.mutateAsync().catch(() => undefined);
                  },
                });
              }}
            >
              Delete
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Period and dates" />
            <DefinitionList
              items={[
                {
                  label: 'Client',
                  value:
                    item.client === null ? (
                      '—'
                    ) : (
                      <Link
                        to={`/clients/${item.client.id}/compliance`}
                        className="rounded-sm text-[var(--fd-accent)] hover:underline"
                      >
                        {item.client.name}
                      </Link>
                    ),
                },
                {
                  label: 'Category',
                  value:
                    item.complianceType === null
                      ? '—'
                      : CATEGORY_LABELS[item.complianceType.category],
                },
                { label: 'Period type', value: PERIOD_TYPE_LABELS[item.periodType] },
                {
                  label: 'Period',
                  value: `${formatDate(item.periodStart)} to ${formatDate(item.periodEnd)}`,
                },
                { label: 'Due date', value: formatDate(item.dueDate) },
                { label: 'Filed date', value: formatDate(item.filedDate, 'Not filed') },
                { label: 'Acknowledgement', value: item.acknowledgementRef ?? '—' },
                { label: 'Owner', value: item.assignedStaff?.name ?? 'Unassigned' },
              ]}
            />

            {item.notApplicableReason === null ? null : (
              <p className="mt-4 border-t border-[var(--fd-border-subtle)] pt-3 text-base text-[var(--fd-text-secondary)]">
                Marked not applicable: {item.notApplicableReason}
              </p>
            )}

            {item.notes === null || item.notes.length === 0 ? null : (
              <p className="mt-4 border-t border-[var(--fd-border-subtle)] pt-3 text-base whitespace-pre-wrap text-[var(--fd-text-primary)]">
                {item.notes}
              </p>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Documents asked for"
              description={
                item.requestProgress.total === 0
                  ? 'Nothing has been requested for this filing.'
                  : `${item.requestProgress.received} of ${item.requestProgress.total} received.`
              }
              actions={
                allows('document_request:write') && item.client !== null ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={<Plus size={14} aria-hidden="true" />}
                    onClick={() => {
                      setRequestOpen(true);
                    }}
                  >
                    Ask for a document
                  </Button>
                ) : undefined
              }
            />

            {item.requestProgress.total > 0 ? (
              <ProgressBar
                className="mb-3"
                value={item.requestProgress.received}
                max={item.requestProgress.total}
                showValue
                tone={
                  item.requestProgress.received === item.requestProgress.total ? 'done' : 'waiting'
                }
                label="Documents received against this filing"
              />
            ) : null}

            <RequestList
              requests={item.requests}
              loading={false}
              emptySlot={
                <EmptyState
                  title="Nothing requested yet"
                  description="Raise a request and the client can upload straight against this filing."
                />
              }
            />
          </Card>

          <Card>
            <CardHeader title="Linked tasks" />
            <TaskTable
              tasks={item.tasks}
              loading={false}
              showClient={false}
              sort={null}
              onSortChange={() => undefined}
              emptySlot={
                <EmptyState
                  title="No tasks linked"
                  description="Link a task to this filing when the work needs breaking down."
                />
              }
            />
          </Card>
        </div>

        <div className="space-y-4">
          <StatusTransition
            complianceId={complianceId}
            current={item.status}
            filedDate={item.filedDate}
            disabled={!allows('compliance:status')}
          />

          <Card>
            <CardHeader title="Adjust" as="h3" />
            <div className="space-y-3">
              <div>
                <span className="mb-1 block text-xs font-medium text-[var(--fd-text-secondary)]">
                  Due date
                </span>
                <DatePicker
                  ariaLabel="Due date"
                  disabled={!canEdit || patch.isPending}
                  value={item.dueDate}
                  onChange={(value) => {
                    if (value !== null) patch.mutate({ dueDate: value });
                  }}
                />
                <p className="mt-1 text-xs text-[var(--fd-text-tertiary)]">
                  Changing this flags the filing as overridden and writes an audit entry.
                </p>
              </div>

              <div>
                <span className="mb-1 block text-xs font-medium text-[var(--fd-text-secondary)]">
                  Owner
                </span>
                <StaffPicker
                  disabled={!canEdit || patch.isPending}
                  value={item.assignedStaff?.id ?? null}
                  onChange={(value) => {
                    patch.mutate({ assignedStaff: value });
                  }}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {item.client === null ? null : (
        <RequestForm
          open={requestOpen}
          onOpenChange={setRequestOpen}
          clientId={item.client.id}
          complianceItemId={item.id}
        />
      )}

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
