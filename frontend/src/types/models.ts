/* Over 400 lines deliberately: this is the hand-written mirror of every backend serialiser, and splitting it would scatter one contract across a dozen files that must be diffed against backend/src/serializers as a set. */
import type { Capability } from '@/lib/permissions';
import type {
  AuditAction,
  AuditEntityKind,
  ClientStatus,
  ClientType,
  ComplianceCategory,
  ComplianceStatus,
  DocumentRequestStatus,
  DocumentType,
  EntityType,
  Frequency,
  GeneratedBy,
  JobName,
  JobStatus,
  NotificationType,
  PeriodType,
  Role,
  SearchKind,
  TaskPriority,
  TaskRecurrenceFrequency,
  TaskStatus,
  UserStatus,
} from '@/types/enums';

export interface NamedRef {
  id: string;
  name: string;
}

export interface PersonRef {
  id: string;
  name: string;
  email: string | null;
}

export interface Contact {
  name: string;
  role: string | null;
  email: string;
  phone: string | null;
}

export interface Address {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

export interface NotificationPreferences {
  emailOnAssignment: boolean;
  emailDeadlineReminders: boolean;
  emailDailyDigest: boolean;
}

export interface Me {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: Role;
  status: UserStatus;
  phone: string | null;
  image: string | null;
  linkedClients: string[];
  pinnedClients: string[];
  notificationPreferences: NotificationPreferences;
  unlinked: boolean;
  permissions: Partial<Record<Capability, boolean>>;
}

export interface DeviceSession {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  current: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: Role;
  status: UserStatus;
  phone: string | null;
  image: string | null;
  linkedClients: NamedRef[];
  notificationPreferences: NotificationPreferences;
  lastSeenAt: string | null;
  createdAt: string | null;
}

export interface StaffOption {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface ClientListRow {
  id: string;
  displayName: string;
  clientType: ClientType;
  status: ClientStatus;
  pan: string | null;
  gstin: string | null;
  primaryContact: Contact;
  assignedStaff: PersonRef[];
  nextDueDate: string | null;
  openRequestCount: number;
  unreadMessageCount: number;
  pinned: boolean;
  archived: boolean;
}

export interface ClientDetail {
  id: string;
  clientType: ClientType;
  displayName: string;
  legalName: string | null;
  status: ClientStatus;
  archived: boolean;
  archivedAt: string | null;
  pan: string | null;
  gstin: string | null;
  tan: string | null;
  cin: string | null;
  entityType: EntityType | null;
  incorporationDate: string | null;
  dateOfBirth: string | null;
  primaryContact: Contact;
  additionalContacts: Contact[];
  address: Address | null;
  assignedStaff: PersonRef[];
  createdAt: string | null;
  updatedAt: string | null;
  notes: string | null;
  aadhaarPresent?: boolean;
}

export interface PortalClientProfile {
  id: string;
  displayName: string;
  legalName: string | null;
  clientType: ClientType;
  status: ClientStatus;
  pan: string | null;
  gstin: string | null;
  tan: string | null;
  cin: string | null;
  entityType: EntityType | null;
  incorporationDate: string | null;
  dateOfBirth: string | null;
  aadhaarPresent: boolean;
  primaryContact: Contact;
  additionalContacts: Contact[];
  address: Address | null;
}

export interface PortalClientOption {
  id: string;
  displayName: string;
}

export type DueDateRule =
  | { kind: 'day_of_following_month'; day: number; monthsAfter: number }
  | { kind: 'days_after_period_end'; days: number }
  | { kind: 'fixed_day_month_after_period'; day: number; month: number; yearsAfter: number };

export interface ChecklistTemplateEntry {
  title: string;
  documentType: DocumentType;
  description: string | null;
}

export interface ComplianceTypeView {
  id: string;
  name: string;
  code: string;
  category: ComplianceCategory;
  isRecurring: boolean;
  defaultFrequency: Frequency;
  dueDateRule: DueDateRule | null;
  defaultDocumentChecklist: ChecklistTemplateEntry[];
  reminderOffsetsDays: number[];
  isSeeded: boolean;
  active: boolean;
}

export interface ComplianceTypeRef {
  id: string;
  name: string;
  category: ComplianceCategory;
}

export interface ClientServiceView {
  id: string;
  complianceType: ComplianceTypeRef | null;
  frequency: Frequency | null;
  startDate: string | null;
  endDate: string | null;
  assignedStaff: PersonRef | null;
  active: boolean;
}

export interface RequestProgress {
  received: number;
  total: number;
}

export interface ComplianceListRow {
  id: string;
  client: NamedRef | null;
  complianceType: ComplianceTypeRef | null;
  periodType: PeriodType;
  periodLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  dueDate: string | null;
  dueDateOverridden: boolean;
  status: ComplianceStatus;
  isOverdue: boolean;
  assignedStaff: PersonRef | null;
  filedDate: string | null;
  requestProgress: RequestProgress;
}

export interface ComplianceDetail extends ComplianceListRow {
  notes: string | null;
  acknowledgementRef: string | null;
  notApplicableReason: string | null;
  generatedBy: GeneratedBy;
  createdAt: string | null;
  updatedAt: string | null;
  requests: DocumentRequestView[];
  tasks: TaskListRow[];
}

export interface PortalComplianceRow {
  id: string;
  complianceTypeName: string;
  periodLabel: string;
  dueDate: string | null;
  status: ComplianceStatus;
  isOverdue: boolean;
  filedDate: string | null;
}

export interface GeneratePreviewRow {
  clientId: string;
  clientName: string;
  complianceTypeName: string;
  periodLabel: string;
  dueDate: string | null;
}

export interface GenerateSkipRow extends Omit<GeneratePreviewRow, 'dueDate'> {
  reason: string;
}

export interface GeneratePreview {
  willCreate: GeneratePreviewRow[];
  willSkip: GenerateSkipRow[];
}

export interface GenerateResult {
  created: number;
  skipped: number;
  requestsCreated: number;
}

export interface TaskListRow {
  id: string;
  title: string;
  client: NamedRef | null;
  assignee: PersonRef | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  isOverdue: boolean;
  internalOnly: boolean;
  checklistDone: number;
  checklistTotal: number;
  blockedCount: number;
}

export interface ChecklistEntry {
  id: string;
  title: string;
  done: boolean;
}

export interface TaskBlocker {
  id: string;
  title: string;
  status: TaskStatus;
}

export interface TaskRecurrence {
  frequency: TaskRecurrenceFrequency;
  interval: number;
  nextRunAt: string | null;
  endDate: string | null;
}

export interface TaskDetail extends TaskListRow {
  description: string | null;
  complianceItem: { id: string; periodLabel: string | null } | null;
  checklist: ChecklistEntry[];
  blockedBy: TaskBlocker[];
  estimateMinutes: number | null;
  loggedMinutes: number;
  attachments: string[];
  recurrence: TaskRecurrence | null;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  blockedByOpen?: string[];
}

export interface PortalTaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
}

export interface TaskComment {
  id: string;
  body: string;
  author: PersonRef | null;
  editedAt: string | null;
  createdAt: string | null;
}

export interface WorkRow {
  kind: 'task' | 'compliance';
  id: string;
  title: string;
  clientId: string | null;
  clientName: string | null;
  dueDate: string | null;
  status: TaskStatus | ComplianceStatus;
  priority: TaskPriority | null;
  isOverdue: boolean;
  link: string;
  periodLabel: string | null;
}

export interface DocumentVersion {
  version: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  uploadedAt: string | null;
}

export interface DocumentListRow {
  id: string;
  client: NamedRef | null;
  title: string;
  documentType: DocumentType;
  customTypeLabel: string | null;
  currentVersion: number;
  versionCount: number;
  sizeBytes: number;
  originalFilename: string;
  mimeType: string;
  uploadedByRole: Role;
  archived: boolean;
  complianceItemId: string | null;
  documentRequestId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface DocumentDetail extends DocumentListRow {
  versions: DocumentVersion[];
}

export interface PresignedUpload {
  uploadUrl: string;
  storageKey: string;
  expiresIn: number;
}

export interface DownloadTicket {
  url: string;
  expiresIn: number;
}

export interface DocumentRequestView {
  id: string;
  client: NamedRef | null;
  complianceItem: { id: string; periodLabel: string | null } | null;
  title: string;
  description: string | null;
  documentType: DocumentType;
  dueDate: string | null;
  status: DocumentRequestStatus;
  isOverdue: boolean;
  fulfilledDocumentId: string | null;
  fulfilledAt: string | null;
  requestedBy: PersonRef | null;
  lastRemindedAt: string | null;
  createdAt: string | null;
}

export interface PortalDocumentRequestView {
  id: string;
  title: string;
  description: string | null;
  documentType: DocumentType;
  dueDate: string | null;
  status: DocumentRequestStatus;
  isOverdue: boolean;
  createdAt: string | null;
}

export interface MessageAttachment {
  id: string;
  title: string;
  documentType: DocumentType;
}

export interface MessageView {
  id: string;
  body: string;
  author: PersonRef | null;
  authorRole: Role;
  attachments: MessageAttachment[];
  contextRef: { kind: string; id: string } | null;
  createdAt: string | null;
  mine: boolean;
}

export interface ThreadView {
  clientId: string;
  clientName: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
}

export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string;
  read: boolean;
  readAt: string | null;
  createdAt: string | null;
}

export interface UnreadCounts {
  notifications: number;
  messages: number;
}

export interface AuditDiffEntry {
  field: string;
  before: unknown;
  after: unknown;
  redacted: boolean;
}

export interface AuditEntry {
  id: string;
  actor: PersonRef | null;
  actorRole: Role | null;
  action: AuditAction;
  entityKind: AuditEntityKind;
  entityId: string | null;
  client: NamedRef | null;
  summary: string | null;
  diff: AuditDiffEntry[];
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string | null;
}

export interface PortalActivityEntry {
  id: string;
  action: AuditAction;
  summary: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  clientCount: number;
  tasksByStatus: Record<string, number>;
  dueIn7: number;
  dueIn14: number;
  dueIn30: number;
  overdueFilings: number;
  awaitingClient: number;
  openRequests: number;
  workload: Array<{ staffId: string; staffName: string; openItems: number }>;
}

export interface ComplianceReportRow {
  id: string;
  clientName: string;
  complianceTypeName: string;
  category: string;
  periodLabel: string;
  dueDate: string | null;
  status: ComplianceStatus;
  isOverdue: boolean;
  filedDate: string | null;
  assignedStaffName: string | null;
}

export interface ComplianceReport {
  totals: Record<string, number>;
  rows: ComplianceReportRow[];
}

export interface WorkloadRow {
  staffId: string;
  staffName: string;
  openTasks: number;
  overdueTasks: number;
  completedTasks: number;
  openFilings: number;
  overdueFilings: number;
  estimateMinutes: number;
  loggedMinutes: number;
}

export interface RosterRow {
  clientId: string;
  displayName: string;
  clientType: ClientType;
  status: ClientStatus;
  services: string[];
  assignedStaff: string[];
  nextDueDate: string | null;
  openRequests: number;
}

export interface PortalOverview {
  dueSoon: number;
  overdue: number;
  awaitingYou: number;
  openRequests: number;
  unreadMessages: number;
  upcoming: PortalComplianceRow[];
}

export interface FirmSettings {
  firmName: string;
  address: Address | null;
  contactEmail: string | null;
  contactPhone: string | null;
  logoStorageKey: string | null;
  financialYearStartMonth: number;
  defaultReminderOffsetsDays?: number[];
  complianceHorizonDays?: number;
}

export interface JobRunView {
  id: string;
  jobName: JobName;
  status: JobStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  result: unknown;
  error: string | null;
}

export interface JobRunOutcome {
  jobName: JobName;
  result: unknown;
  error: string | null;
}

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  link: string;
}

export interface SearchResults {
  clients: SearchHit[];
  tasks: SearchHit[];
  compliance: SearchHit[];
  documents: SearchHit[];
}

export interface AssignmentResult {
  client: ClientDetail;
  orphanedOpenItems: number;
}
