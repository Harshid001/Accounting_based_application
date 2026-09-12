import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useState } from 'react';

import {
  createTaskComment,
  deleteTaskComment,
  listTaskComments,
} from '@/api/taskComments.api';
import { queryKeys } from '@/api/queryKeys';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { IconButton } from '@/components/ui/icon-button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser, useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { formatDateTime } from '@/lib/date';
import { taskCommentSchema } from '@/schemas/task.schema';
import type { TaskCommentValues } from '@/schemas/task.schema';

const EDIT_WINDOW_MS = 15 * 60 * 1000;

export function TaskComments({ taskId }: { taskId: string }) {
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const { allows } = useSession();
  const { errorToast } = useToast();
  const [openedAt] = useState(() => Date.now());

  const pageQuery = { page: 1, limit: 50 };
  const query = useQuery({
    queryKey: queryKeys.tasks.comments(taskId, pageQuery),
    queryFn: () => listTaskComments(taskId, pageQuery),
    enabled: allows('task_comment:read'),
    staleTime: 15_000,
  });

  const form = useForm<TaskCommentValues>({
    resolver: zodResolver(taskCommentSchema),
    defaultValues: { body: '' },
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.comments(taskId) });
  };

  const create = useMutation({
    mutationFn: (body: string) => createTaskComment(taskId, body),
    onSuccess: () => {
      invalidate();
      form.reset({ body: '' });
    },
    onError: (error: unknown) => {
      errorToast(error, 'That comment was not posted');
    },
  });

  const remove = useMutation({
    mutationFn: deleteTaskComment,
    onSuccess: invalidate,
    onError: (error: unknown) => {
      errorToast(error, 'That comment was not deleted');
    },
  });

  if (!allows('task_comment:read')) return null;

  const canDelete = (authorId: string | undefined, createdAt: string | null): boolean => {
    if (user.role === 'admin') return true;
    if (authorId !== user.id) return false;
    if (createdAt === null) return false;
    return openedAt - new Date(createdAt).getTime() < EDIT_WINDOW_MS;
  };

  const submit = form.handleSubmit(async (values) => {
    await create.mutateAsync(values.body).catch(() => undefined);
  });

  return (
    <Card>
      <CardHeader
        title="Internal comments"
        description="Staff only. These never appear in the client portal."
      />

      {query.isError ? (
        <ErrorState
          compact
          error={query.error}
          title="Comments did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : query.isPending ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-12 w-full" rounded="lg" />
          <Skeleton className="h-12 w-full" rounded="lg" />
        </div>
      ) : query.data.items.length === 0 ? (
        <p className="text-base text-[var(--fd-text-tertiary)]">
          No comments yet. Anything you write here stays inside the firm.
        </p>
      ) : (
        <ul className="space-y-3">
          {query.data.items.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <Avatar name={comment.author?.name ?? 'Removed user'} size="sm" className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-xs font-medium text-[var(--fd-text-primary)]">
                    {comment.author?.name ?? 'Removed user'}
                  </span>
                  <time
                    dateTime={comment.createdAt ?? undefined}
                    className="text-2xs text-[var(--fd-text-tertiary)]"
                  >
                    {formatDateTime(comment.createdAt)}
                  </time>
                  {comment.editedAt === null ? null : (
                    <span className="text-2xs text-[var(--fd-text-tertiary)]">edited</span>
                  )}
                </div>
                <p className="mt-0.5 text-base whitespace-pre-wrap text-[var(--fd-text-primary)]">
                  {comment.body}
                </p>
              </div>
              {canDelete(comment.author?.id, comment.createdAt) ? (
                <IconButton
                  label="Delete this comment"
                  size="sm"
                  icon={<Trash2 size={13} aria-hidden="true" />}
                  onClick={() => {
                    remove.mutate(comment.id);
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {allows('task_comment:write') ? (
        <form
          onSubmit={(event) => {
            void submit(event);
          }}
          className="mt-4 space-y-2 border-t border-[var(--fd-border-subtle)] pt-4"
        >
          <FormField label="Add a comment" hideLabel error={form.formState.errors.body?.message}>
            {({ inputId, describedBy, invalid }) => (
              <Textarea
                id={inputId}
                rows={3}
                invalid={invalid}
                aria-describedby={describedBy}
                placeholder="Add an internal note for whoever picks this up"
                {...form.register('body')}
              />
            )}
          </FormField>
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              loading={create.isPending}
              loadingLabel="Posting your comment"
            >
              Post comment
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
