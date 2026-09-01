import type {
  ClientStatus,
  ClientType,
  ComplianceCategory,
  ComplianceStatus,
  DocumentRequestStatus,
  DocumentType,
  EntityType,
  Frequency,
  JobName,
  PeriodType,
  Role,
  TaskPriority,
  TaskRecurrenceFrequency,
  TaskStatus,
  UserStatus,
} from '@/types/enums';

export const MAX_UPLOAD_BYTES = 26_214_400;
export const MAX_UPLOAD_LABEL = '25 MB';
export const MAX_DOCUMENT_VERSIONS = 20;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export const UNREAD_POLL_MS = 50_000;
export const SEARCH_DEBOUNCE_MS = 250;
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;
export const SKELETON_DELAY_MS = 300;

export const THEME_STORAGE_KEY = 'firmdesk.theme';
export const ACTIVE_CLIENT_STORAGE_PREFIX = 'firmdesk.activeClient';
export const SIDEBAR_STORAGE_KEY = 'firmdesk.sidebar';

export const ACTIVE_CLIENT_HEADER = 'X-Active-Client';
export const REQUEST_ID_HEADER = 'X-Request-Id';

export const PUBLIC_PATHS = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/unlinked',
  '/403',
  '/404',
] as const;

export interface UploadKind {
  extension: string;
  mimeType: string;
}

export const ALLOWED_UPLOADS: readonly UploadKind[] = [
  { extension: 'pdf', mimeType: 'application/pdf' },
  { extension: 'jpg', mimeType: 'image/jpeg' },
  { extension: 'jpeg', mimeType: 'image/jpeg' },
  { extension: 'png', mimeType: 'image/png' },
  {
    extension: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  { extension: 'xls', mimeType: 'application/vnd.ms-excel' },
  { extension: 'csv', mimeType: 'text/csv' },
  {
    extension: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  { extension: 'zip', mimeType: 'application/zip' },
];

export const ALLOWED_MIME_TYPES: readonly string[] = [
  ...new Set(ALLOWED_UPLOADS.map((entry) => entry.mimeType)),
];

export const ALLOWED_EXTENSIONS: readonly string[] = ALLOWED_UPLOADS.map(
  (entry) => entry.extension,
);

export const UPLOAD_ACCEPT_ATTRIBUTE = ALLOWED_UPLOADS.map(
  (entry) => `.${entry.extension}`,
).join(',');

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  staff: 'Staff',
  client: 'Client',
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Active',
  deactivated: 'Deactivated',
};

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  individual: 'Individual',
  business: 'Business',
};

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  onboarding: 'Onboarding',
  active: 'Active',
  inactive: 'Inactive',
};

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  pvt_ltd: 'Private limited',
  public_ltd: 'Public limited',
  llp: 'LLP',
  partnership: 'Partnership',
  proprietorship: 'Proprietorship',
  huf: 'HUF',
  trust: 'Trust',
  society: 'Society',
  aop_boi: 'AOP / BOI',
};

export const CATEGORY_LABELS: Record<ComplianceCategory, string> = {
  gst: 'GST',
  income_tax: 'Income tax',
  tds: 'TDS',
  roc: 'ROC',
  advisory: 'Advisory',
  other: 'Other',
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  half_yearly: 'Half yearly',
  annual: 'Annual',
  one_time: 'One time',
};

export const PERIOD_TYPE_LABELS: Record<PeriodType, string> = {
  month: 'Month',
  quarter: 'Quarter',
  half_year: 'Half year',
  financial_year: 'Financial year',
};

export const COMPLIANCE_STATUS_LABELS: Record<ComplianceStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  awaiting_client: 'Awaiting client',
  filed: 'Filed',
  acknowledged: 'Acknowledged',
  not_applicable: 'Not applicable',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  review: 'Review',
  done: 'Done',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const RECURRENCE_LABELS: Record<TaskRecurrenceFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  purchase_invoice: 'Purchase bill',
  sales_invoice: 'Sales bill',
  bank_statement: 'Bank statement',
  tax_document: 'Tax document',
  income_proof: 'Income proof',
  expense_document: 'Expense document',
  audit_document: 'Audit document',
  other: 'Other',
};

export const REQUEST_STATUS_LABELS: Record<DocumentRequestStatus, string> = {
  open: 'Open',
  fulfilled: 'Received',
  cancelled: 'Cancelled',
};

export const JOB_LABELS: Record<JobName, string> = {
  generateComplianceItems: 'Generate filings',
  sendDeadlineReminders: 'Deadline reminders',
  sendAdminDigest: 'Admin digest',
  purgeUnlinkedAccounts: 'Purge unlinked accounts',
  rollRecurringTasks: 'Roll recurring tasks',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  status_change: 'Status changed',
  assign: 'Assigned',
  archive: 'Archived',
  restore: 'Restored',
  hard_delete: 'Deleted',
  export: 'Exported',
  reveal_aadhaar: 'Revealed Aadhaar',
  send_client_email: 'Emailed client',
  sign_in: 'Signed in',
  role_change: 'Role changed',
};

export const SEEDED_DUE_DATE_HINT =
  'Seeded default — verify against current notifications before you rely on it.';
