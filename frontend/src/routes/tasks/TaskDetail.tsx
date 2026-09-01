import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { changeTaskStatus, deleteTask, getTask, updateTask } from '@/api/tasks.api';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, DefinitionList } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { OverdueBadge, PriorityBadge } from '@/components/domain/StatusPills';
import { StaffPicker } from '@/components/domain/StaffPicker';
import { TaskStatusSelect } from '@/components/domain/TaskStatusSelect';
import { TaskComments } from '@/routes/tasks/components/TaskComments';
import {
  RecurrencePanel,
  TaskChecklist,
  TaskDependencies,
  TimePanel,
} from '@/routes/tasks/components/TaskSidePanels';
import { useConfirm } from '@/hooks/useConfirm';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { formatDate } from '@/lib/date';
import { assignTask } from '@/api/tasks.api';
import type { TaskStatus } from '@/types/enums';

export function TaskDetail() {
  const { taskId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { allows } = useSession();
  const { success, errorToast } = useToast();
  const confirm = useConfirm();

  const query = useQuery({
    queryKey: queryKeys.tasks.detail(taskId),
    queryFn: () => getTask(taskId),
    enabled: taskId.length > 0,
  });

  usePageTitle(query.data?.title ?? 'Task');

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.myWork() });
  };

  const status = useMutation({
    mutationFn: (next: TaskStatus) => changeTaskStatus(taskId, next),
    onSuccess: (task) => {
      invalidate();
      success('Status updated', `Now ${task.status.replace('_', ' ')}.`);
    },
    onError: (error: unknown) => {
      errorToast(error, 'That status did not change');
    },
  });

  const assign = useMutation({
    mutationFn: (assigneeId: string) => assignTask(taskId, assigneeId),
    onSuccess: (task) => {
      invalidate();
      success('Task reassigned', `${task.assignee?.name ?? 'Someone else'} owns it now.`);
    },
    onError: (error: unknown) => {
      errorToast(error, 'That reassignment did not save');
    },
  });

  const checklist = useMutation({
    mutationFn: (input: { id: string; done: boolean }) => {
      const current = query.data?.checklist ?? [];
      return updateTask(taskId, {
        checklist: current.map((entry) => ({
          title: entry.title,
          done: entry.id === input.id ? input.done : entry.done,
        })),
      });
    },
    onSuccess: invalidate,
    onError: (error: unknown) => {
      errorToast(error, 'That sub-task did not save');
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteTask(taskId),
    onSuccess: () => {
      invalidate();
      success('Task deleted');
      void navigate('/tasks', { replace: true });
    },
    onError: (error: unknown) => {
      errorToast(error, 'That task was not deleted');
    },
  });

  if (query.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-40 w-full" rounded="lg" />
        <Skeleton className="h-32 w-full" rounded="lg" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        title="That task did not load"
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  const task = query.data;
  const blocked = task.blockedBy.some((blocker) => blocker.status !== 'done');

  return (
    <>
      <PageHeader
        breadcrumb={
          <Breadcrumb items={[{ label: 'Tasks', to: '/tasks' }, { label: task.title }]} />
        }
        title={task.title}
        meta={
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PriorityBadge priority={task.priority} />
            <OverdueBadge overdue={task.isOverdue} />
            {task.internalOnly ? (
              <Badge tone="muted">Internal only</Badge>
            ) : (
              <Badge tone="accent">Title visible to the client</Badge>
            )}
            {blocked ? <Badge tone="waiting">Blocked</Badge> : null}
          </div>
        }
        actions={
          allows('task:delete') ? (
            <Button
              variant="danger"
              size="sm"
              iconLeft={<Trash2 size={14} aria-hidden="true" />}
              onClick={() => {
                confirm.ask({
                  title: `Delete ${task.title}?`,
                  body: 'The task and its comments are removed. This cannot be undone.',
                  confirmLabel: 'Delete task',
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Detail" />
            <DefinitionList
              items={[
                {
                  label: 'Client',
                  value:
                    task.client === null ? (
                      'Internal work'
                    ) : (
                      <Link
                        to={`/clients/${task.client.id}/tasks`}
                        className="rounded-sm text-[var(--fd-accent)] hover:underline"
                      >
                        {task.client.name}
                      </Link>
                    ),
                },
                { label: 'Due date', value: formatDate(task.dueDate, 'No due date') },
                {
                  label: 'Linked filing',
                  value:
                    task.complianceItem === null ? (
                      '—'
                    ) : (
                      <Link
                        to={`/compliance/${task.complianceItem.id}`}
                        className="rounded-sm text-[var(--fd-accent)] hover:underline"
                      >
                        {task.complianceItem.periodLabel ?? 'View filing'}
                      </Link>
                    ),
                },
                { label: 'Created', value: formatDate(task.createdAt) },
              ]}
            />

            {task.description === null || task.description.length === 0 ? null : (
              <p className="mt-4 border-t border-[var(--fd-border-subtle)] pt-4 text-base whitespace-pre-wrap text-[var(--fd-text-primary)]">
                {task.description}
              </p>
            )}
          </Card>

          <TaskChecklist
            task={task}
            readOnly={!allows('task:update')}
            onToggle={(id, done) => {
              checklist.mutate({ id, done });
            }}
          />

          <TaskComments taskId={taskId} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Status and owner" as="h3" />
            <div className="space-y-3">
              <div>
                <span
                  aria-hidden="true"
                  className="mb-1 block text-xs font-medium text-[var(--fd-text-secondary)]"
                >
                  Status
                </span>
                <TaskStatusSelect
                  value={task.status}
                  disabled={!allows('task:update') || status.isPending}
                  onChange={(next) => {
                    status.mutate(next);
                  }}
                />
              </div>

              <div>
                <span className="mb-1 block text-xs font-medium text-[var(--fd-text-secondary)]">
                  Owner
                </span>
                <StaffPicker
                  allowClear={false}
                  disabled={!allows('task:assign') || assign.isPending}
                  value={task.assignee?.id ?? null}
                  onChange={(next) => {
                    if (next !== null) assign.mutate(next);
                  }}
                />
              </div>
            </div>
          </Card>

          <TaskDependencies task={task} />
          <TimePanel task={task} />
          <RecurrencePanel task={task} />
        </div>
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
