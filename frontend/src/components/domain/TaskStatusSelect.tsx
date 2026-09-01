import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/lib/constants';
import { Select } from '@/components/ui/select';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/types/enums';
import type { TaskPriority, TaskStatus } from '@/types/enums';

export const taskStatusOptions = TASK_STATUSES.map((status) => ({
  value: status,
  label: TASK_STATUS_LABELS[status],
}));

export const taskPriorityOptions = TASK_PRIORITIES.map((priority) => ({
  value: priority,
  label: TASK_PRIORITY_LABELS[priority],
}));

export interface TaskStatusSelectProps {
  value: TaskStatus;
  onChange: (value: TaskStatus) => void;
  id?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string | undefined;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function TaskStatusSelect({
  value,
  onChange,
  id,
  ariaLabel = 'Task status',
  ariaDescribedBy,
  disabled = false,
  size = 'md',
}: TaskStatusSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        onChange(next as TaskStatus);
      }}
      options={taskStatusOptions}
      {...(id === undefined ? {} : { id })}
      ariaLabel={ariaLabel}
      ariaDescribedBy={ariaDescribedBy}
      disabled={disabled}
      size={size}
    />
  );
}

export interface PrioritySelectProps {
  value: TaskPriority;
  onChange: (value: TaskPriority) => void;
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export function PrioritySelect({
  value,
  onChange,
  id,
  ariaLabel = 'Priority',
  disabled = false,
}: PrioritySelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        onChange(next as TaskPriority);
      }}
      options={taskPriorityOptions}
      {...(id === undefined ? {} : { id })}
      ariaLabel={ariaLabel}
      disabled={disabled}
    />
  );
}
