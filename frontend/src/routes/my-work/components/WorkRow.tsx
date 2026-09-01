import { CalendarClock, CheckSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/cn';
import { COMPLIANCE_STATUS_LABELS, TASK_STATUS_LABELS } from '@/lib/constants';
import { formatDate, relativeDeadline } from '@/lib/date';
import { Badge } from '@/components/ui/badge';
import { OverdueBadge, PriorityBadge } from '@/components/domain/StatusPills';
import type { WorkRow as WorkRowModel } from '@/types/models';
import type { ComplianceStatus, TaskStatus } from '@/types/enums';

const statusLabel = (row: WorkRowModel): string =>
  row.kind === 'task'
    ? TASK_STATUS_LABELS[row.status as TaskStatus]
    : COMPLIANCE_STATUS_LABELS[row.status as ComplianceStatus];

export function WorkRow({ row }: { row: WorkRowModel }) {
  return (
    <li data-print="row">
      <Link
        to={row.link}
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-3 transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]',
          row.isOverdue
            ? 'border-[var(--fd-status-danger)] bg-[var(--fd-status-danger-bg)]'
            : 'border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] hover:bg-[var(--fd-surface-3)]',
        )}
      >
        <span className="shrink-0 text-[var(--fd-text-tertiary)]">
          {row.kind === 'task' ? (
            <CheckSquare size={15} aria-hidden="true" />
          ) : (
            <CalendarClock size={15} aria-hidden="true" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium text-[var(--fd-text-primary)]">
            {row.title}
            {row.periodLabel === null ? '' : ` — ${row.periodLabel}`}
          </span>
          <span className="text-2xs block truncate text-[var(--fd-text-tertiary)]">
            {row.kind === 'task' ? 'Task' : 'Filing'}
            {row.clientName === null ? ' · Internal work' : ` · ${row.clientName}`}
          </span>
        </span>

        <span className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge tone="neutral">{statusLabel(row)}</Badge>
          {row.priority === null ? null : <PriorityBadge priority={row.priority} />}
          <OverdueBadge overdue={row.isOverdue} />
          <span className="numeric text-xs text-[var(--fd-text-secondary)]">
            {formatDate(row.dueDate, 'No due date')}
          </span>
          {row.dueDate === null ? null : (
            <span className="text-2xs hidden text-[var(--fd-text-tertiary)] sm:inline">
              {relativeDeadline(row.dueDate)}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
