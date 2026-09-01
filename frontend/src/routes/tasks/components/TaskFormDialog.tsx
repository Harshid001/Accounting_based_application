import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { createTask } from '@/api/tasks.api';
import { queryKeys } from '@/api/queryKeys';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog } from '@/components/ui/dialog';
import { FieldRow, FormField } from '@/components/ui/form-field';
import { InlineError } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ClientPicker } from '@/components/domain/ClientPicker';
import { StaffPicker } from '@/components/domain/StaffPicker';
import { PrioritySelect, TaskStatusSelect } from '@/components/domain/TaskStatusSelect';
import { useToast } from '@/context/ToastContext';
import { fieldErrorMap, normaliseError } from '@/lib/errors';
import { emptyTask, taskSchema, toTaskPayload } from '@/schemas/task.schema';
import type { TaskFormValues } from '@/schemas/task.schema';
import { useState } from 'react';

export interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lockedClientId?: string;
  assignableStaff?: readonly string[];
}

export function TaskFormDialog({
  open,
  onOpenChange,
  lockedClientId,
  assignableStaff,
}: TaskFormDialogProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { success } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { ...emptyTask, clientId: lockedClientId ?? '' },
  });

  useEffect(() => {
    if (open) {
      form.reset({ ...emptyTask, clientId: lockedClientId ?? '' });
      setFormError(null);
    }
  }, [open, lockedClientId, form]);

  const mutation = useMutation({
    mutationFn: createTask,
    onSuccess: (task) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myWork() });
      success('Task added', task.title);
      onOpenChange(false);
      if (lockedClientId === undefined) void navigate(`/tasks/${task.id}`);
    },
    onError: (error: unknown) => {
      const normalised = normaliseError(error);
      setFormError(normalised.message);
      for (const [field, message] of Object.entries(fieldErrorMap(normalised))) {
        form.setError(field as keyof TaskFormValues, { type: 'server', message });
      }
    },
  });

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    await mutation
      .mutateAsync(toTaskPayload(values, { includeClient: true }))
      .catch(() => undefined);
  });

  const internalOnly = form.watch('internalOnly');

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add a task"
      size="lg"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            loadingLabel="Adding this task"
            onClick={() => {
              void submit();
            }}
          >
            Add task
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError === null ? null : <InlineError message={formError} />}

        <div
          role="note"
          className="rounded-md border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] px-3 py-2 text-xs text-[var(--fd-text-secondary)]"
        >
          {internalOnly
            ? 'Internal only: the client sees nothing about this task.'
            : 'The client can see this task’s title, status and due date. Nothing else.'}
        </div>

        <FormField label="Title" required error={form.formState.errors.title?.message}>
          {({ inputId, describedBy, invalid }) => (
            <Input
              id={inputId}
              invalid={invalid}
              aria-describedby={describedBy}
              placeholder="File GSTR-3B for July"
              {...form.register('title')}
            />
          )}
        </FormField>

        {lockedClientId === undefined ? (
          <FormField label="Client" helper="Leave blank for internal work.">
            {({ inputId, describedBy }) => (
              <Controller
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <ClientPicker
                    id={inputId}
                    ariaDescribedBy={describedBy}
                    value={field.value.length === 0 ? null : field.value}
                    onChange={(value) => {
                      field.onChange(value ?? '');
                    }}
                  />
                )}
              />
            )}
          </FormField>
        ) : null}

        <FormField label="Owner" required error={form.formState.errors.assigneeId?.message}>
          {({ inputId, describedBy, invalid }) => (
            <Controller
              control={form.control}
              name="assigneeId"
              render={({ field }) => (
                <StaffPicker
                  id={inputId}
                  ariaDescribedBy={describedBy}
                  invalid={invalid}
                  {...(assignableStaff === undefined ? {} : { restrictTo: assignableStaff })}
                  value={field.value.length === 0 ? null : field.value}
                  onChange={(value) => {
                    field.onChange(value ?? '');
                  }}
                />
              )}
            />
          )}
        </FormField>

        <FieldRow>
          <FormField label="Priority">
            {({ inputId }) => (
              <Controller
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <PrioritySelect id={inputId} value={field.value} onChange={field.onChange} />
                )}
              />
            )}
          </FormField>

          <FormField label="Status">
            {({ inputId }) => (
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <TaskStatusSelect id={inputId} value={field.value} onChange={field.onChange} />
                )}
              />
            )}
          </FormField>
        </FieldRow>

        <FieldRow>
          <FormField label="Due date" error={form.formState.errors.dueDate?.message}>
            {({ inputId, describedBy, invalid }) => (
              <Controller
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <DatePicker
                    id={inputId}
                    ariaLabel="Due date"
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

          <FormField
            label="Estimate in minutes"
            error={form.formState.errors.estimateMinutes?.message}
          >
            {({ inputId, describedBy, invalid }) => (
              <Input
                id={inputId}
                inputMode="numeric"
                className="numeric"
                invalid={invalid}
                aria-describedby={describedBy}
                placeholder="90"
                {...form.register('estimateMinutes')}
              />
            )}
          </FormField>
        </FieldRow>

        <FormField label="Description" error={form.formState.errors.description?.message}>
          {({ inputId, describedBy, invalid }) => (
            <Textarea
              id={inputId}
              rows={4}
              invalid={invalid}
              aria-describedby={describedBy}
              placeholder="Anything the person doing this needs to know."
              {...form.register('description')}
            />
          )}
        </FormField>

        <Controller
          control={form.control}
          name="internalOnly"
          render={({ field }) => (
            <Checkbox
              checked={field.value}
              onCheckedChange={field.onChange}
              label="Internal only"
              description="Hides the task entirely from the client portal."
            />
          )}
        />
      </div>
    </Dialog>
  );
}
