import { Link } from 'react-router-dom';

import { Card, CardHeader } from '@/components/ui/card';
import { Checklist } from '@/components/ui/checklist';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatusPill } from '@/components/ui/status-pill';
import { TASK_STATUS_LABELS, RECURRENCE_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/date';
import { formatMinutes } from '@/lib/format';
import type { TaskDetail } from '@/types/models';

export function TaskChecklist({
  task,
  readOnly,
  onToggle,
}: {
  task: TaskDetail;
  readOnly: boolean;
  onToggle: (id: string, done: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader title="Sub-tasks" as="h3" />
      <Checklist items={task.checklist} readOnly={readOnly} onToggle={onToggle} />
    </Card>
  );
}

export function TaskDependencies({ task }: { task: TaskDetail }) {
  if (task.blockedBy.length === 0) return null;

  const open = task.blockedBy.filter((blocker) => blocker.status !== 'done');

  return (
    <Card>
      <CardHeader
        title="Blocked by"
        as="h3"
        description={
          open.length === 0
            ? 'Everything this task waits on is finished.'
            : `${open.length} of these must finish before this task can start.`
        }
      />
      <ul className="space-y-2">
        {task.blockedBy.map((blocker) => (
          <li key={blocker.id} className="flex items-center justify-between gap-2">
            <Link
              to={`/tasks/${blocker.id}`}
              className="min-w-0 truncate rounded-sm text-base text-[var(--fd-accent)] hover:underline"
            >
              {blocker.title}
            </Link>
            <StatusPill
              tone={blocker.status === 'done' ? 'done' : 'waiting'}
              label={TASK_STATUS_LABELS[blocker.status]}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function TimePanel({ task }: { task: TaskDetail }) {
  const estimate = task.estimateMinutes ?? 0;

  return (
    <Card>
      <CardHeader title="Time" as="h3" />
      <dl className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-xs text-[var(--fd-text-tertiary)]">Estimated</dt>
          <dd className="numeric text-base text-[var(--fd-text-primary)]">
            {estimate === 0 ? 'Not estimated' : formatMinutes(estimate)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-xs text-[var(--fd-text-tertiary)]">Logged</dt>
          <dd className="numeric text-base text-[var(--fd-text-primary)]">
            {formatMinutes(task.loggedMinutes)}
          </dd>
        </div>
        {estimate === 0 ? null : (
          <ProgressBar
            value={Math.min(task.loggedMinutes, estimate)}
            max={estimate}
            tone={task.loggedMinutes > estimate ? 'waiting' : 'accent'}
            label={`${task.loggedMinutes} of ${estimate} estimated minutes logged`}
          />
        )}
        {task.completedAt === null ? null : (
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-xs text-[var(--fd-text-tertiary)]">Completed</dt>
            <dd className="numeric text-base text-[var(--fd-text-primary)]">
              {formatDate(task.completedAt)}
            </dd>
          </div>
        )}
      </dl>
    </Card>
  );
}

export function RecurrencePanel({ task }: { task: TaskDetail }) {
  if (task.recurrence === null) return null;

  return (
    <Card>
      <CardHeader title="Repeats" as="h3" />
      <p className="text-base text-[var(--fd-text-primary)]">
        Every {task.recurrence.interval}{' '}
        {RECURRENCE_LABELS[task.recurrence.frequency].toLowerCase()} cycle
      </p>
      <p className="mt-1 text-xs text-[var(--fd-text-tertiary)]">
        Next occurrence {formatDate(task.recurrence.nextRunAt)}
        {task.recurrence.endDate === null ? '' : ` · ends ${formatDate(task.recurrence.endDate)}`}
      </p>
    </Card>
  );
}
