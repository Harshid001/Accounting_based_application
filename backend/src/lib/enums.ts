export const ROLES = ['admin', 'staff', 'client'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['active', 'deactivated'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const CLIENT_TYPES = ['individual', 'business'] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const CLIENT_STATUSES = ['onboarding', 'active', 'inactive'] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const ENTITY_TYPES = [
  'pvt_ltd',
  'public_ltd',
  'llp',
  'partnership',
  'proprietorship',
  'huf',
  'trust',
  'society',
  'aop_boi',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const COMPLIANCE_CATEGORIES = [
  'gst',
  'income_tax',
  'tds',
  'roc',
  'advisory',
  'other',
] as const;
export type ComplianceCategory = (typeof COMPLIANCE_CATEGORIES)[number];

export const FREQUENCIES = [
  'monthly',
  'quarterly',
  'half_yearly',
  'annual',
  'one_time',
] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const DUE_DATE_RULE_KINDS = [
  'day_of_following_month',
  'days_after_period_end',
  'fixed_day_month_after_period',
] as const;
export type DueDateRuleKind = (typeof DUE_DATE_RULE_KINDS)[number];

export const PERIOD_TYPES = ['month', 'quarter', 'half_year', 'financial_year'] as const;
export type PeriodType = (typeof PERIOD_TYPES)[number];

export const COMPLIANCE_STATUSES = [
  'pending',
  'in_progress',
  'awaiting_client',
  'filed',
  'acknowledged',
  'not_applicable',
] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

export const CLOSED_COMPLIANCE_STATUSES: readonly ComplianceStatus[] = [
  'filed',
  'acknowledged',
  'not_applicable',
];

export const GENERATED_BY = ['scheduler', 'bulk', 'manual'] as const;
export type GeneratedBy = (typeof GENERATED_BY)[number];

export const TASK_STATUSES = ['not_started', 'in_progress', 'review', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export const TASK_RECURRENCE_FREQUENCIES = [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'annual',
] as const;
export type TaskRecurrenceFrequency = (typeof TASK_RECURRENCE_FREQUENCIES)[number];

export const DOCUMENT_TYPES = [
  'purchase_invoice',
  'sales_invoice',
  'bank_statement',
  'tax_document',
  'income_proof',
  'expense_document',
  'audit_document',
  'other',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_REQUEST_STATUSES = ['open', 'fulfilled', 'cancelled'] as const;
export type DocumentRequestStatus = (typeof DOCUMENT_REQUEST_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'task_assigned',
  'task_reassigned',
  'awaiting_client',
  'request_fulfilled',
  'new_message',
  'deadline_due',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const CONTEXT_REF_KINDS = ['compliance_item', 'document_request'] as const;
export type ContextRefKind = (typeof CONTEXT_REF_KINDS)[number];

export const AUDIT_ACTIONS = [
  'create',
  'update',
  'status_change',
  'assign',
  'archive',
  'restore',
  'hard_delete',
  'export',
  'reveal_aadhaar',
  'send_client_email',
  'sign_in',
  'role_change',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ENTITY_KINDS = [
  'user',
  'client',
  'complianceType',
  'clientService',
  'complianceItem',
  'task',
  'taskComment',
  'document',
  'documentRequest',
  'message',
  'firmSettings',
  'session',
] as const;
export type AuditEntityKind = (typeof AUDIT_ENTITY_KINDS)[number];

export const JOB_STATUSES = ['running', 'succeeded', 'failed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_NAMES = [
  'generateComplianceItems',
  'sendDeadlineReminders',
  'sendAdminDigest',
  'purgeUnlinkedAccounts',
  'rollRecurringTasks',
] as const;
export type JobName = (typeof JOB_NAMES)[number];

export const MAX_UPLOAD_BYTES = 26_214_400;
export const MAX_DOCUMENT_VERSIONS = 20;

export const ALLOWED_UPLOAD_TYPES: ReadonlyArray<{
  mimeType: string;
  extensions: readonly string[];
}> = [
  { mimeType: 'application/pdf', extensions: ['pdf'] },
  { mimeType: 'image/jpeg', extensions: ['jpg', 'jpeg'] },
  { mimeType: 'image/png', extensions: ['png'] },
  {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: ['xlsx'],
  },
  { mimeType: 'application/vnd.ms-excel', extensions: ['xls'] },
  { mimeType: 'text/csv', extensions: ['csv'] },
  {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['docx'],
  },
  { mimeType: 'application/zip', extensions: ['zip'] },
];

export const ALLOWED_MIME_TYPES: readonly string[] = ALLOWED_UPLOAD_TYPES.map(
  (entry) => entry.mimeType,
);

export const ALLOWED_UPLOAD_EXTENSIONS: readonly string[] = ALLOWED_UPLOAD_TYPES.flatMap(
  (entry) => entry.extensions,
);

export const REDACTED_AUDIT_FIELDS: readonly string[] = [
  'aadhaar',
  'aadhaarEncrypted',
  'password',
  'passwordHash',
  'token',
  'secret',
  'storageKey',
];

const alwaysAllowed: readonly ComplianceStatus[] = [
  'pending',
  'in_progress',
  'awaiting_client',
  'filed',
  'acknowledged',
  'not_applicable',
];

export const COMPLIANCE_TRANSITIONS: Record<ComplianceStatus, readonly ComplianceStatus[]> = {
  pending: alwaysAllowed,
  in_progress: alwaysAllowed,
  awaiting_client: alwaysAllowed,
  filed: alwaysAllowed,
  acknowledged: [],
  not_applicable: ['pending'],
};
