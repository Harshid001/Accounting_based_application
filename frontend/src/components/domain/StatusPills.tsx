import { StatusPill } from '@/components/ui/status-pill';
import type { StatusTone } from '@/components/ui/status-pill';
import {
  COMPLIANCE_STATUS_LABELS,
  REQUEST_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  USER_STATUS_LABELS,
  CLIENT_STATUS_LABELS,
} from '@/lib/constants';
import type {
  ClientStatus,
  ComplianceStatus,
  DocumentRequestStatus,
  TaskPriority,
  TaskStatus,
  UserStatus,
} from '@/types/enums';

const COMPLIANCE_TONES: Record<ComplianceStatus, StatusTone> = {
  pending: 'neutral',
  in_progress: 'progress',
  awaiting_client: 'waiting',
  filed: 'done',
  acknowledged: 'confirmed',
  not_applicable: 'muted',
};

const TASK_TONES: Record<TaskStatus, StatusTone> = {
  not_started: 'neutral',
  in_progress: 'progress',
  review: 'review',
  done: 'done',
};

const CLIENT_TONES: Record<ClientStatus, StatusTone> = {
  onboarding: 'progress',
  active: 'done',
  inactive: 'muted',
};

const REQUEST_TONES: Record<DocumentRequestStatus, StatusTone> = {
  open: 'waiting',
  fulfilled: 'done',
  cancelled: 'muted',
};

const USER_TONES: Record<UserStatus, StatusTone> = {
  active: 'done',
  deactivated: 'muted',
};

export function ComplianceStatusPill({ status }: { status: ComplianceStatus }) {
  return (
    <StatusPill
      tone={COMPLIANCE_TONES[status]}
      label={COMPLIANCE_STATUS_LABELS[status]}
      dashed={status === 'not_applicable'}
    />
  );
}

export function TaskStatusPill({ status }: { status: TaskStatus }) {
  return <StatusPill tone={TASK_TONES[status]} label={TASK_STATUS_LABELS[status]} />;
}

export function ClientStatusPill({ status }: { status: ClientStatus }) {
  return <StatusPill tone={CLIENT_TONES[status]} label={CLIENT_STATUS_LABELS[status]} />;
}

export function RequestStatusPill({ status }: { status: DocumentRequestStatus }) {
  return (
    <StatusPill
      tone={REQUEST_TONES[status]}
      label={REQUEST_STATUS_LABELS[status]}
      dashed={status === 'cancelled'}
    />
  );
}

export function UserStatusPill({ status }: { status: UserStatus }) {
  return <StatusPill tone={USER_TONES[status]} label={USER_STATUS_LABELS[status]} />;
}

const PRIORITY_TONES: Record<TaskPriority, StatusTone | null> = {
  low: 'neutral',
  normal: null,
  high: 'waiting',
  urgent: 'danger',
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const tone = PRIORITY_TONES[priority];
  if (tone === null) {
    return (
      <span className="text-xs text-[var(--fd-text-tertiary)]">
        {TASK_PRIORITY_LABELS[priority]}
      </span>
    );
  }
  return <StatusPill tone={tone} label={TASK_PRIORITY_LABELS[priority]} />;
}

export function OverdueBadge({ overdue }: { overdue: boolean }) {
  if (!overdue) return null;
  return <StatusPill tone="danger" label="Overdue" />;
}
