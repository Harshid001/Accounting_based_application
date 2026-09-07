import { GoogleGenAI } from '@google/genai';
import type { FunctionCall as GeminiFunctionCall, Part as GeminiPart } from '@google/genai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import OpenAI from 'openai';
import { Types } from 'mongoose';

import { logger } from '../config/logger.js';
import { addDays, formatDisplayDate, todayIST } from '../lib/date.js';
import {
  CLOSED_COMPLIANCE_STATUSES,
  COMPLIANCE_CATEGORIES,
  COMPLIANCE_STATUSES,
  DOCUMENT_TYPES,
  FREQUENCIES,
  PERIOD_TYPES,
  ROLES,
} from '../lib/enums.js';
import type {
  ComplianceCategory,
  ComplianceStatus,
  DocumentType,
  Frequency,
  PeriodType,
  Role,
  TaskPriority,
  TaskStatus,
} from '../lib/enums.js';
import { forbidden } from '../lib/errors.js';
import { escapeRegex } from '../lib/identifiers.js';
import { toPageRequest } from '../lib/pagination.js';
import { ComplianceItem } from '../models/complianceItem.model.js';
import { ComplianceType } from '../models/complianceType.model.js';
import { Task } from '../models/task.model.js';
import type { AiProviderName } from '../models/firmSettings.model.js';
import type { AuthenticatedUser, RequestActor } from '../types/context.js';
import {
  dashboardSummary,
  complianceReport,
  workloadReport,
  rosterReport,
} from './report.service.js';
import {
  createDocumentRequests,
  listDocumentRequests,
  cancelDocumentRequest,
  sendManualReminder,
} from './documentRequest.service.js';
import {
  accessibleClientIds,
  updateComplianceItem,
  changeComplianceStatus,
  createComplianceItem,
} from './compliance.service.js';
import {
  getPreparation,
  prepareFiling,
  updateGuideStep,
} from './filingPreparation.service.js';
import {
  createClientService,
  listClientServices,
  deleteClientService,
} from './clientService.service.js';
import {
  listClients,
  createClient,
  updateClient,
  getClientDetail,
  setArchived,
} from './client.service.js';
import {
  createTask,
  listTasks,
  updateTask,
  assignTask,
  deleteTask,
} from './task.service.js';
import { createTaskComment } from './taskComment.service.js';
import { listComplianceTypes } from './complianceType.service.js';
import {
  planFromClientServices,
  planBulk,
  commitPlan,
} from './complianceGenerator.service.js';
import { listDocuments } from './document.service.js';
import { postMessage, listMessages } from './message.service.js';
import { listUsers, changeRole, setLinkedClients } from './user.service.js';
import { resolveAiProvider, getFirmSettings, updateFirmSettings } from './settings.service.js';

export interface AgentChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentToolBadge {
  tool: string;
  label: string;
}

export interface AgentAction {
  label: string;
  route: string;
}

export interface AgentReply {
  content: string;
  toolCalls: AgentToolBadge[];
  actions: AgentAction[];
  mode: 'llm' | 'fallback';
}

interface AgentContext {
  user: AuthenticatedUser;
  actor: RequestActor;
  history: AgentChatTurn[];
  currentRoute: string | null;
  image?: { dataUrl: string; mimeType?: string } | null;
}

const MAX_AGENT_ITERATIONS = 8;
const MAX_HISTORY_TURNS = 20;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const TOOL_NAMES = {
  // Client Management
  searchClients: 'search_clients',
  createClient: 'create_client',
  updateClient: 'update_client',
  getClientDetails: 'get_client_details',
  archiveClient: 'archive_client',

  // Client Services & Subscriptions
  addClientService: 'add_client_service',
  listClientServices: 'list_client_services',
  deleteClientService: 'delete_client_service',

  // Compliance & Statutory Filings
  complianceFilings: 'get_compliance_filings',
  updateFilingStatus: 'update_filing_status',
  updateFiling: 'update_filing',
  generateComplianceFilings: 'generate_compliance_filings',
  createComplianceFiling: 'create_compliance_filing',
  listComplianceTypes: 'list_compliance_types',
  upcomingDeadlines: 'get_upcoming_deadlines',
  prepareFilingReturn: 'prepare_filing_return',
  getFilingGuide: 'get_filing_guide',
  updateFilingGuideStep: 'update_filing_guide_step',

  // Autonomous Practice Automation Runner
  runAutonomousPracticeAutomation: 'run_autonomous_practice_automation',

  // Tasks & Workflow
  createTask: 'create_task',
  listTasks: 'list_tasks',
  updateTask: 'update_task',
  assignTask: 'assign_task',
  addTaskComment: 'add_task_comment',
  deleteTask: 'delete_task',

  // Document Requests & Documents
  createDocumentRequest: 'create_document_request',
  listDocumentRequests: 'list_document_requests',
  cancelDocumentRequest: 'cancel_document_request',
  sendDocumentReminder: 'send_document_reminder',
  listClientDocuments: 'list_client_documents',

  // Client Communications & Messaging
  sendClientMessage: 'send_client_message',
  listClientMessages: 'list_client_messages',

  // Team & Organization
  listTeamMembers: 'list_team_members',
  updateUserRole: 'update_user_role',
  linkClientUser: 'link_client_user',

  // Firm Settings
  getFirmSettings: 'get_firm_settings',
  updateFirmSettings: 'update_firm_settings',

  // Reports & Analytics
  firmSummary: 'get_firm_summary',
  getComplianceReport: 'get_compliance_report',
  getTeamWorkloadReport: 'get_team_workload_report',
  getClientRosterReport: 'get_client_roster_report',
} as const;

type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

const SYSTEM_PROMPT = `You are FirmDesk Copilot, the autonomous practice management executive and master automation AI agent inside FirmDesk, built for an Indian Chartered Accountancy (CA) firm. Today is {TODAY} (IST) and the user is {USER}, a firm {ROLE} user, currently viewing {ROUTE}.

## TOTAL CONTROL & AUTONOMOUS AUTHORITY
You possess COMPLETE AND UNRESTRICTED OPERATIONAL CONTROL over the FirmDesk website, database, practice workflows, and client operations.
You operate directly at the core backend API and database layer with full executive privileges.

### CRITICAL RULES ON EXECUTIVE ACTION (NEVER VIOLATE):
1. NEVER emit disclaimers such as:
   - "While I cannot autonomously run full end-to-end background automation..."
   - "I cannot click around the web interface independently without user instructions..."
   - "Navigate to /xyz to do this manually"
   Because you do NOT need to "click around" buttons — you have direct backend tools to inspect, create, update, delete, and automate every single entity immediately.
2. When asked to "automate the website", "run practice health check", "execute option 1", or run firm routines, TAKE TOTAL EXECUTIVE OWNERSHIP: immediately invoke the relevant tools (e.g. run_autonomous_practice_automation, generate_compliance_filings, create_task, add_client_service, etc.), perform the actions, and report the real completed results.
3. If asked to setup filings or services for a client, add the services with add_client_service, trigger generate_compliance_filings, or create custom filings with create_compliance_filing.
4. If asked to chase documents, raise document requests or trigger email reminders with send_document_reminder.
5. If asked to manage workload, create and reassign tasks with create_task, assign_task, and update_task.

## Capabilities & Automation Powers
You can perform and automate all the following operations directly via tools:
1. **Full Practice Automation**: Execute end-to-end practice health check runs (deadlines audit, bulk generation, urgent task scheduling, and team capacity digest) via run_autonomous_practice_automation.
2. **Client Management**: Search clients, fetch full profiles, create new clients (individual/business with PAN, GSTIN, contacts, address), update existing client details, and archive/restore clients.
3. **Client Services**: Attach recurring statutory services (GSTR-1, GSTR-3B, TDS, ITR) with add_client_service, inspect with list_client_services, or delete with delete_client_service.
4. **Statutory Compliance & Filings**: Track statutory filings (GST, TDS, Income Tax, ROC/MCA), update filing statuses (mark as filed, in_progress, awaiting_client, acknowledged, not_applicable), record ARN / challan / acknowledgement numbers and filed dates, update filing notes/due dates, bulk-generate statutory filings for periods, create custom filings, and inspect compliance types.
   **Return preparation & filing (accountant work)**: Prepare returns end-to-end with prepare_filing_return — it aggregates the documents uploaded against the filing, computes the tax liability (output tax/ITC for GST, slab tax for ITR, TDS for 24Q/26Q), and lists any missing inputs. Then guide the filing on the actual government portal with get_filing_guide (exact portal login, data entry, payment and ARN steps for the GST Portal, Income Tax Portal, TRACES and MCA V3) and track progress with update_filing_guide_step. When asked to "file GSTR-3B for a client", first find the filing with get_compliance_filings, prepare it, raise document requests for anything missing, then walk the user through the portal steps and record the ARN with update_filing_status.
5. **Tasks & Workflow**: Create tasks, search/list tasks by status/priority/assignee, update task status (not_started, in_progress, review, done), update due dates/priorities, reassign tasks to team members, add internal task comments/notes, and delete tasks.
6. **Document Requests & Files**: Raise document requests to clients, list open/fulfilled requests, cancel requests, trigger reminder emails to clients, and inspect client uploaded documents.
7. **Client Communications**: Post messages and official notices directly into client portal threads, and inspect message history.
8. **Team & Account Management**: List practice team members (admins & staff), update user roles (admin/staff/client), and link client accounts to client records.
9. **Firm Settings**: Inspect and update firm profile details, contact email/phone, office address, and practice preferences.
10. **Reports & Analytics**: Pull live firm summaries, statutory compliance reports, team workload reports, and client roster scorecards.
11. **Tax Advisory & Drafting**: Answer Indian tax/statutory questions citing sections, thresholds, and due dates; draft professional notices, emails, and client advice.

## Operational Rules
- Never invent firm data or IDs. Always call the relevant tool to fetch live records or confirm changes.
- Scoping & Permissions: All tools execute under the authenticated user's permissions and access scope. Staff can only access clients assigned to them. Firm settings and role updates require admin role.
- Route Context: When the user is on a page like /clients/<id>/*, treat "this client" as that client id.
- Client resolution: When asked to perform an action for a client by name (e.g., "for Mayur Bhai"), first call search_clients with their name to obtain their 24-character clientId. If found, use that clientId.
- Dates: All date parameters must be YYYY-MM-DD.
- Be proactive, decisive, and helpful: execute requested operations cleanly, summarize the result, and mention what was updated or created.
- At the very end you may suggest up to 3 follow-up navigation actions, one per line:
  [ACTION] label | route
  Allowed base routes: /dashboard /clients /tasks /my-work /compliance /compliance/generate /requests /messages /reports /settings (or subroutes like /clients/<id>, /tasks/<id>)`;

const VALID_ACTION_ROUTES = new Set([
  '/dashboard',
  '/clients',
  '/tasks',
  '/my-work',
  '/compliance',
  '/compliance/generate',
  '/requests',
  '/messages',
  '/reports',
  '/settings',
]);

const isValidActionRoute = (route: string): boolean => {
  if (VALID_ACTION_ROUTES.has(route)) return true;
  return /^\/(clients|tasks|compliance|requests|messages|reports|settings|portal)(\/[a-zA-Z0-9_-]+)*$/.test(route);
};

const namedOf = (value: unknown, key: string): string | null => {
  if (value === null || typeof value !== 'object') return null;
  const found = (value as Record<string, unknown>)[key];
  return typeof found === 'string' ? found : null;
};

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const filingsProjection = (items: unknown[]): unknown =>
  items.map((raw) => {
    const item = raw as Record<string, unknown>;
    return {
      id: String(item._id),
      clientName: namedOf(item.client, 'displayName') ?? 'Unknown client',
      filingName: namedOf(item.complianceType, 'name') ?? 'Filing',
      category: namedOf(item.complianceType, 'category') ?? 'other',
      periodLabel: item.periodLabel,
      dueDate: formatDisplayDate(item.dueDate as Date | null),
      status: item.status,
    };
  });

// ---------------------------------------------------------------------------
// Tool implementations — every query is scoped through the AuthenticatedUser
// ---------------------------------------------------------------------------

// 1. Clients
const tool_searchClients = async (
  user: AuthenticatedUser,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const query = asString(args.query)?.trim();
  const status =
    args.status === 'onboarding' || args.status === 'active' || args.status === 'inactive'
      ? args.status
      : undefined;
  const { items, total } = await listClients(
    user,
    {
      ...(typeof query === 'string' && query.trim().length > 0 ? { q: query.trim() } : {}),
      ...(status !== undefined ? { status } : {}),
    },
    toPageRequest(1, 10),
  );
  return {
    total,
    clients: items.map((client) => ({
      id: client._id.toString(),
      displayName: client.displayName,
      clientType: client.clientType,
      status: client.status,
      pan: client.pan ?? null,
      gstin: client.gstin ?? null,
    })),
  };
};

const tool_createClient = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  if (user.role === 'client') {
    return { error: 'Client portal accounts cannot create new clients.' };
  }
  const displayName = asString(args.displayName)?.trim();
  if (!displayName || displayName.length < 2) {
    return { error: 'A valid client display name (at least 2 characters) is required.' };
  }
  const clientType: 'individual' | 'business' =
    args.clientType === 'individual' ? 'individual' : 'business';
  const pan = asString(args.pan)?.toUpperCase().trim() || null;
  const gstin = asString(args.gstin)?.toUpperCase().trim() || null;
  const tan = asString(args.tan)?.toUpperCase().trim() || null;
  const cin = asString(args.cin)?.toUpperCase().trim() || null;
  const email = asString(args.email)?.trim();
  const phone = asString(args.phone)?.trim();
  const notes = asString(args.notes)?.trim() || null;
  const status: 'onboarding' | 'active' = args.status === 'onboarding' ? 'onboarding' : 'active';

  const primaryContact =
    email || phone
      ? {
          name: displayName,
          email: email ?? '',
          phone: phone ?? '',
          designation: clientType === 'individual' ? 'Self' : 'Proprietor / Director',
        }
      : undefined;

  try {
    const created = await createClient(
      {
        displayName,
        legalName: asString(args.legalName)?.trim() || displayName,
        clientType,
        status,
        pan,
        gstin,
        tan,
        cin,
        primaryContact,
        address: asString(args.address)
          ? {
              line1: asString(args.address)!,
              city: asString(args.city) || 'Patan',
              state: asString(args.state) || 'Gujarat',
              pincode: asString(args.pincode) || '384265',
            }
          : undefined,
        assignedStaff: [user.id.toString()],
        notes,
      },
      context.actor,
    );
    return {
      created: true,
      clientId: created._id.toString(),
      displayName: created.displayName,
      clientType: created.clientType,
      status: created.status,
      pan: created.pan,
      gstin: created.gstin,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not create client.' };
  }
};

const tool_updateClient = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  if (user.role === 'client') {
    return { error: 'Client portal accounts cannot edit clients.' };
  }
  const clientId = asString(args.clientId);
  if (!clientId || !OBJECT_ID_PATTERN.test(clientId)) {
    return { error: 'A valid 24-character clientId is required.' };
  }
  const scoped = await accessibleClientIds(user);
  if (scoped !== null && !scoped.some((id) => id.toString() === clientId)) {
    return { error: 'You do not have access to that client.' };
  }

  const payload: Record<string, unknown> = {};
  if (asString(args.displayName)) payload.displayName = asString(args.displayName)!.trim();
  if (asString(args.legalName)) payload.legalName = asString(args.legalName)!.trim();
  if (asString(args.pan)) payload.pan = asString(args.pan)!.toUpperCase().trim();
  if (asString(args.gstin)) payload.gstin = asString(args.gstin)!.toUpperCase().trim();
  if (asString(args.tan)) payload.tan = asString(args.tan)!.toUpperCase().trim();
  if (asString(args.cin)) payload.cin = asString(args.cin)!.toUpperCase().trim();
  if (args.status === 'onboarding' || args.status === 'active' || args.status === 'inactive') {
    payload.status = args.status;
  }
  if (asString(args.notes) !== undefined) payload.notes = asString(args.notes)!.trim();
  if (asString(args.email) || asString(args.phone)) {
    payload.primaryContact = {
      name: asString(args.contactName) || asString(args.displayName) || 'Primary Contact',
      email: asString(args.email) || '',
      phone: asString(args.phone) || '',
      designation: 'Authorized Signatory',
    };
  }

  try {
    const updated = await updateClient(new Types.ObjectId(clientId), payload, context.actor);
    return {
      updated: true,
      clientId: updated._id.toString(),
      displayName: updated.displayName,
      status: updated.status,
      pan: updated.pan,
      gstin: updated.gstin,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not update client.' };
  }
};

const tool_getClientDetails = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const clientId = asString(args.clientId);
  if (!clientId || !OBJECT_ID_PATTERN.test(clientId)) {
    return { error: 'A valid 24-character clientId is required.' };
  }
  const scoped = await accessibleClientIds(context.user);
  if (scoped !== null && !scoped.some((id) => id.toString() === clientId)) {
    return { error: 'You do not have access to that client.' };
  }

  try {
    const client = await getClientDetail(new Types.ObjectId(clientId));
    return {
      id: client._id.toString(),
      displayName: client.displayName,
      legalName: client.legalName,
      clientType: client.clientType,
      status: client.status,
      pan: client.pan,
      gstin: client.gstin,
      tan: client.tan,
      cin: client.cin,
      primaryContact: client.primaryContact,
      address: client.address,
      assignedStaff: Array.isArray(client.assignedStaff)
        ? client.assignedStaff.map((s: unknown) => namedOf(s, 'name') ?? 'Staff')
        : [],
      notes: client.notes,
      archived: client.archived,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Client not found.' };
  }
};

const tool_archiveClient = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  if (user.role === 'client') {
    return { error: 'Client portal accounts cannot archive clients.' };
  }
  const clientId = asString(args.clientId);
  if (!clientId || !OBJECT_ID_PATTERN.test(clientId)) {
    return { error: 'A valid 24-character clientId is required.' };
  }
  const scoped = await accessibleClientIds(user);
  if (scoped !== null && !scoped.some((id) => id.toString() === clientId)) {
    return { error: 'You do not have access to that client.' };
  }
  const archived = args.archived !== false;
  try {
    const updated = await setArchived(new Types.ObjectId(clientId), archived, context.actor);
    return {
      archived: updated.archived,
      clientId: updated._id.toString(),
      displayName: updated.displayName,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not change client archive state.' };
  }
};

// 2. Compliance & Statutory Filings
const tool_getComplianceFilings = async (
  user: AuthenticatedUser,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const clientId =
    typeof args.clientId === 'string' && OBJECT_ID_PATTERN.test(args.clientId) ? args.clientId : undefined;
  const category = COMPLIANCE_CATEGORIES.includes(args.category as ComplianceCategory)
    ? (args.category as ComplianceCategory)
    : undefined;
  const status = COMPLIANCE_STATUSES.includes(args.status as ComplianceStatus)
    ? (args.status as ComplianceStatus)
    : undefined;
  const limit =
    typeof args.limit === 'number' && Number.isFinite(args.limit)
      ? Math.min(Math.max(Math.trunc(args.limit), 1), 50)
      : 20;

  const scoped = await accessibleClientIds(user);
  let clientFilter: Record<string, unknown> = {};
  if (scoped !== null) {
    if (clientId !== undefined && !scoped.some((id) => id.toString() === clientId)) {
      return { error: 'You do not have access to that client.' };
    }
    clientFilter = clientId !== undefined ? { client: clientId } : { client: { $in: scoped } };
  } else if (clientId !== undefined) {
    clientFilter = { client: clientId };
  }

  const items = await ComplianceItem.find({
    ...clientFilter,
    ...(category !== undefined
      ? { complianceType: { $in: (await ComplianceType.find({ category }).select('_id').lean().exec()).map((t) => t._id) } }
      : {}),
    ...(status !== undefined ? { status } : {}),
  })
    .sort({ dueDate: 1 })
    .limit(limit)
    .populate('client', 'displayName')
    .populate('complianceType', 'name category')
    .lean()
    .exec();

  return { count: items.length, filings: filingsProjection(items) };
};

const tool_updateFilingStatus = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  if (user.role === 'client') {
    return { error: 'Client portal accounts cannot change filing status.' };
  }
  const filingId = asString(args.filingId);
  if (!filingId || !OBJECT_ID_PATTERN.test(filingId)) {
    return { error: 'A valid 24-character filingId is required.' };
  }
  const status = args.status as ComplianceStatus;
  if (!COMPLIANCE_STATUSES.includes(status)) {
    return { error: `Invalid status. Choose one of: ${COMPLIANCE_STATUSES.join(', ')}.` };
  }

  const filedDate =
    typeof args.filedDate === 'string' && DATE_ONLY_PATTERN.test(args.filedDate)
      ? new Date(`${args.filedDate}T00:00:00.000Z`)
      : status === 'filed' || status === 'acknowledged'
        ? todayIST()
        : undefined;

  const notApplicableReason =
    asString(args.notApplicableReason) ||
    (status === 'not_applicable' ? 'Marked not applicable by assistant' : undefined);

  try {
    const updated = await changeComplianceStatus(
      new Types.ObjectId(filingId),
      { status, filedDate, notApplicableReason },
      context.actor,
    );

    const ref = asString(args.acknowledgementRef)?.trim();
    if (ref && ref.length > 0) {
      await updateComplianceItem(
        new Types.ObjectId(filingId),
        { acknowledgementRef: ref },
        context.actor,
      );
    }

    return {
      updated: true,
      filingId: updated._id.toString(),
      status: updated.status,
      filedDate: formatDisplayDate(updated.filedDate),
      acknowledgementRef: ref || updated.acknowledgementRef || null,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not update filing status.' };
  }
};

const tool_updateFiling = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  if (user.role === 'client') {
    return { error: 'Client portal accounts cannot edit filings.' };
  }
  const filingId = asString(args.filingId);
  if (!filingId || !OBJECT_ID_PATTERN.test(filingId)) {
    return { error: 'A valid 24-character filingId is required.' };
  }
  const patch: Record<string, unknown> = {};
  if (typeof args.dueDate === 'string' && DATE_ONLY_PATTERN.test(args.dueDate)) {
    patch.dueDate = new Date(`${args.dueDate}T00:00:00.000Z`);
  }
  if (typeof args.assignedStaffId === 'string' && OBJECT_ID_PATTERN.test(args.assignedStaffId)) {
    patch.assignedStaff = args.assignedStaffId;
  }
  if (typeof args.notes === 'string') {
    patch.notes = args.notes.slice(0, 4000);
  }
  if (typeof args.acknowledgementRef === 'string') {
    patch.acknowledgementRef = args.acknowledgementRef.trim();
  }

  try {
    const updated = await updateComplianceItem(new Types.ObjectId(filingId), patch, context.actor);
    return {
      updated: true,
      filingId: updated._id.toString(),
      dueDate: formatDisplayDate(updated.dueDate),
      notes: updated.notes,
      acknowledgementRef: updated.acknowledgementRef,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not update filing.' };
  }
};

const tool_generateComplianceFilings = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  if (user.role !== 'admin') {
    return { error: 'Only firm administrators can bulk generate statutory filings.' };
  }
  const startDateStr = asString(args.startDate);
  const endDateStr = asString(args.endDate);
  const start =
    startDateStr && DATE_ONLY_PATTERN.test(startDateStr)
      ? new Date(`${startDateStr}T00:00:00.000Z`)
      : todayIST();
  const end =
    endDateStr && DATE_ONLY_PATTERN.test(endDateStr)
      ? new Date(`${endDateStr}T23:59:59.999Z`)
      : addDays(start, 90);

  const complianceTypeId = asString(args.complianceTypeId);
  const clientIds = Array.isArray(args.clientIds)
    ? args.clientIds
        .filter((id): id is string => typeof id === 'string' && OBJECT_ID_PATTERN.test(id))
        .map((id) => id)
    : undefined;

  try {
    let plan;
    if (complianceTypeId && OBJECT_ID_PATTERN.test(complianceTypeId)) {
      plan = await planBulk({
        complianceTypeId,
        periodStart: start,
        periodEnd: end,
        clientIds,
      });
    } else {
      plan = await planFromClientServices(start, end);
    }
    const result = await commitPlan(plan, 'bulk', context.actor);
    return {
      success: true,
      created: result.created,
      skipped: result.skipped,
      requestsCreated: result.requestsCreated,
      dateRange: `${formatDisplayDate(start)} to ${formatDisplayDate(end)}`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Filing generation failed.' };
  }
};

const tool_listComplianceTypes = async (
  _user: AuthenticatedUser,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const category = COMPLIANCE_CATEGORIES.includes(args.category as ComplianceCategory)
    ? (args.category as ComplianceCategory)
    : undefined;
  const q = asString(args.query)?.trim();
  const types = await listComplianceTypes({ category, q, active: true });
  return {
    count: types.length,
    complianceTypes: types.map((t) => ({
      id: t._id.toString(),
      name: t.name,
      code: t.code,
      category: t.category,
      defaultFrequency: t.defaultFrequency,
    })),
  };
};

const tool_getUpcomingDeadlines = async (
  user: AuthenticatedUser,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const horizon =
    typeof args.horizonDays === 'number' && Number.isFinite(args.horizonDays)
      ? Math.min(Math.max(Math.trunc(args.horizonDays), 1), 90)
      : 14;

  const scoped = await accessibleClientIds(user);
  const clientScope = scoped === null ? {} : { client: { $in: scoped } };
  const today = todayIST();
  const open = { ...clientScope, status: { $nin: CLOSED_COMPLIANCE_STATUSES } };

  const [upcoming, overdue] = await Promise.all([
    ComplianceItem.find({ ...open, dueDate: { $gte: today, $lte: addDays(today, horizon) } })
      .sort({ dueDate: 1 })
      .limit(50)
      .populate('client', 'displayName')
      .populate('complianceType', 'name category')
      .lean()
      .exec(),
    ComplianceItem.find({ ...open, dueDate: { $lt: today } })
      .sort({ dueDate: 1 })
      .limit(50)
      .populate('client', 'displayName')
      .populate('complianceType', 'name category')
      .lean()
      .exec(),
  ]);

  return {
    today: formatDisplayDate(today),
    horizonDays: horizon,
    overdueCount: overdue.length,
    upcoming: filingsProjection(upcoming),
    overdue: filingsProjection(overdue),
  };
};

// 2b. Return preparation & guided filing (the accountant work)
const tool_prepareFilingReturn = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  if (user.role === 'client') {
    return { error: 'Client portal accounts cannot prepare returns.' };
  }
  const filingId = asString(args.filingId);
  if (!filingId || !OBJECT_ID_PATTERN.test(filingId)) {
    return { error: 'A valid 24-character filingId is required.' };
  }
  try {
    const prepared = await prepareFiling(user, new Types.ObjectId(filingId), context.actor);
    return {
      success: true,
      preparationId: prepared.preparationId,
      filingId: prepared.complianceItemId,
      form: prepared.formName,
      period: prepared.periodLabel,
      status: prepared.status,
      netTaxPayable: prepared.summary['netTaxPayable'] ?? null,
      totalTaxLiability: prepared.summary['totalTaxLiability'] ?? null,
      advanceTaxPayable: prepared.summary['advanceTaxPayable'] ?? null,
      tdsDeducted: prepared.summary['tdsDeducted'] ?? null,
      inputCounts: {
        salesInvoices: prepared.inputCounts.salesInvoiceCount,
        purchaseInvoices: prepared.inputCounts.purchaseInvoiceCount,
        bankStatements: prepared.inputCounts.bankStatementCount,
        taxDocuments: prepared.inputCounts.taxDocumentCount,
        incomeProofs: prepared.inputCounts.incomeProofCount,
      },
      missingInputs: prepared.missingInputs,
      portal: prepared.portalName,
      nextStep:
        prepared.missingInputs.length > 0
          ? 'Raise document requests for the missing inputs, then prepare again.'
          : 'Open the guided filing steps to file it on the government portal.',
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not prepare the return.' };
  }
};

const tool_getFilingGuide = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const filingId = asString(args.filingId);
  if (!filingId || !OBJECT_ID_PATTERN.test(filingId)) {
    return { error: 'A valid 24-character filingId is required.' };
  }
  try {
    const prepared = await getPreparation(context.user, new Types.ObjectId(filingId));
    return {
      form: prepared.formName,
      period: prepared.periodLabel,
      portal: prepared.portalName,
      portalUrl: prepared.portalUrl,
      status: prepared.status,
      steps: prepared.guideSteps.map((step, index) => ({
        number: index + 1,
        title: step.title,
        detail: step.detail,
        url: step.portalUrl,
        done: step.done,
      })),
      summary: prepared.summary,
      missingInputs: prepared.missingInputs,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not load the filing guide.' };
  }
};

const tool_updateFilingGuideStep = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  if (user.role === 'client') {
    return { error: 'Client portal accounts cannot update guide steps.' };
  }
  const filingId = asString(args.filingId);
  const stepNumber = typeof args.stepNumber === 'number' ? Math.trunc(args.stepNumber) : NaN;
  if (!filingId || !OBJECT_ID_PATTERN.test(filingId) || !Number.isFinite(stepNumber)) {
    return { error: 'A valid filingId and stepNumber are required.' };
  }
  const done = args.done !== false;
  try {
    const prepared = await updateGuideStep(
      user,
      new Types.ObjectId(filingId),
      { stepIndex: stepNumber - 1, done },
      context.actor,
    );
    return {
      success: true,
      filingId,
      stepNumber,
      done,
      completedSteps: prepared.guideSteps.filter((s) => s.done).length,
      totalSteps: prepared.guideSteps.length,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not update the guide step.' };
  }
};

// 3. Tasks & Workflow
const tool_createTask = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  if (user.role === 'client') {
    return { error: 'Client portal accounts cannot create tasks. Ask your firm to create it.' };
  }
  const title = typeof args.title === 'string' ? args.title.trim() : '';
  if (title.length < 3) {
    return { error: 'A task title of at least 3 characters is required.' };
  }
  const priority = (['low', 'normal', 'high', 'urgent'] as const).includes(args.priority as TaskPriority)
    ? (args.priority as TaskPriority)
    : 'normal';

  const dueDate =
    typeof args.dueDate === 'string' && DATE_ONLY_PATTERN.test(args.dueDate)
      ? new Date(`${args.dueDate}T00:00:00.000Z`)
      : null;

  const requestedClient =
    typeof args.clientId === 'string' && OBJECT_ID_PATTERN.test(args.clientId) ? args.clientId : null;
  if (requestedClient !== null) {
    const scoped = await accessibleClientIds(user);
    if (scoped !== null && !scoped.some((id) => id.toString() === requestedClient)) {
      return { error: 'You do not have access to that client.' };
    }
  }

  const assigneeId =
    typeof args.assigneeId === 'string' && OBJECT_ID_PATTERN.test(args.assigneeId)
      ? args.assigneeId
      : user.id.toString();

  try {
    const created = await createTask(
      {
        title: title.slice(0, 200),
        description: typeof args.description === 'string' ? args.description.slice(0, 8000) : null,
        clientId: requestedClient,
        assigneeId,
        priority,
        dueDate,
      },
      user,
      context.actor,
    );
    return {
      created: true,
      taskId: created._id.toString(),
      title: created.title,
      priority: created.priority,
      dueDate: formatDisplayDate(created.dueDate),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'The task could not be created.' };
  }
};

const tool_listTasks = async (
  user: AuthenticatedUser,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const status = (['not_started', 'in_progress', 'review', 'done'] as const).includes(args.status as TaskStatus)
    ? (args.status as TaskStatus)
    : undefined;
  const priority = (['low', 'normal', 'high', 'urgent'] as const).includes(args.priority as TaskPriority)
    ? (args.priority as TaskPriority)
    : undefined;
  const clientId = asString(args.clientId);
  const q = asString(args.query)?.trim();
  const overdue = args.overdue === true;
  const limit =
    typeof args.limit === 'number' && Number.isFinite(args.limit)
      ? Math.min(Math.max(Math.trunc(args.limit), 1), 50)
      : 20;

  const { items, total } = await listTasks(
    user,
    {
      status,
      priority,
      client: clientId && OBJECT_ID_PATTERN.test(clientId) ? clientId : undefined,
      q,
      overdue,
    },
    toPageRequest(1, limit),
  );

  return {
    total,
    tasks: items.map((task) => ({
      id: task._id.toString(),
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: formatDisplayDate(task.dueDate),
      clientName: namedOf(task.client, 'displayName') ?? null,
      assigneeName: namedOf(task.assignee, 'name') ?? null,
    })),
  };
};

const tool_updateTask = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  if (user.role === 'client') {
    return { error: 'Client portal accounts cannot edit tasks.' };
  }
  const taskId = asString(args.taskId);
  if (!taskId || !OBJECT_ID_PATTERN.test(taskId)) {
    return { error: 'A valid 24-character taskId is required.' };
  }
  const patch: Record<string, unknown> = {};
  if (asString(args.title)) patch.title = asString(args.title)!.trim().slice(0, 200);
  if (asString(args.description) !== undefined) {
    patch.description = asString(args.description)!.slice(0, 8000);
  }
  if ((['not_started', 'in_progress', 'review', 'done'] as const).includes(args.status as TaskStatus)) {
    patch.status = args.status;
  }
  if ((['low', 'normal', 'high', 'urgent'] as const).includes(args.priority as TaskPriority)) {
    patch.priority = args.priority;
  }
  if (typeof args.dueDate === 'string' && DATE_ONLY_PATTERN.test(args.dueDate)) {
    patch.dueDate = new Date(`${args.dueDate}T00:00:00.000Z`);
  }
  if (typeof args.assigneeId === 'string' && OBJECT_ID_PATTERN.test(args.assigneeId)) {
    patch.assigneeId = args.assigneeId;
  }

  try {
    const updated = await updateTask(new Types.ObjectId(taskId), patch, user, context.actor);
    return {
      updated: true,
      taskId: updated._id.toString(),
      title: updated.title,
      status: updated.status,
      priority: updated.priority,
      dueDate: formatDisplayDate(updated.dueDate),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not update task.' };
  }
};

const tool_assignTask = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  if (user.role === 'client') {
    return { error: 'Client portal accounts cannot assign tasks.' };
  }
  const taskId = asString(args.taskId);
  const assigneeId = asString(args.assigneeId);
  if (!taskId || !OBJECT_ID_PATTERN.test(taskId) || !assigneeId || !OBJECT_ID_PATTERN.test(assigneeId)) {
    return { error: 'Valid taskId and assigneeId are required.' };
  }
  try {
    const updated = await assignTask(new Types.ObjectId(taskId), assigneeId, user, context.actor);
    return {
      reassigned: true,
      taskId: updated._id.toString(),
      title: updated.title,
      assigneeId,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not reassign task.' };
  }
};

const tool_addTaskComment = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  const taskId = asString(args.taskId);
  const comment = asString(args.comment)?.trim();
  if (!taskId || !OBJECT_ID_PATTERN.test(taskId) || !comment || comment.length < 2) {
    return { error: 'A valid taskId and comment text are required.' };
  }
  try {
    const created = await createTaskComment(
      new Types.ObjectId(taskId),
      comment.slice(0, 4000),
      user,
      context.actor,
    );
    return {
      commentId: created._id.toString(),
      taskId,
      authorName: user.name,
      added: true,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not add comment.' };
  }
};

const tool_deleteTask = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  if (user.role === 'client') {
    return { error: 'Client portal accounts cannot delete tasks.' };
  }
  const taskId = asString(args.taskId);
  if (!taskId || !OBJECT_ID_PATTERN.test(taskId)) {
    return { error: 'A valid 24-character taskId is required.' };
  }
  try {
    await deleteTask(new Types.ObjectId(taskId), context.actor);
    return { deleted: true, taskId };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not delete task.' };
  }
};

// 4. Document Requests & Documents
const documentTypeFrom = (raw: unknown): DocumentType =>
  DOCUMENT_TYPES.includes(raw as DocumentType) ? (raw as DocumentType) : 'other';

const tool_createDocumentRequest = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  if (user.role === 'client') {
    return { error: 'Client portal accounts cannot raise document requests.' };
  }
  const clientId =
    typeof args.clientId === 'string' && OBJECT_ID_PATTERN.test(args.clientId) ? args.clientId : null;
  if (clientId === null) {
    return { error: 'A valid clientId is required to raise a document request.' };
  }
  const title = typeof args.title === 'string' ? args.title.trim() : '';
  if (title.length < 3) {
    return { error: 'A request title of at least 3 characters is required.' };
  }
  const scoped = await accessibleClientIds(user);
  if (scoped !== null && !scoped.some((id) => id.toString() === clientId)) {
    return { error: 'You do not have access to that client.' };
  }
  const documents = Array.isArray(args.requestedDocuments)
    ? args.requestedDocuments.filter(
        (item): item is { title: string; documentType?: string } =>
          item !== null &&
          typeof item === 'object' &&
          typeof (item as Record<string, unknown>).title === 'string' &&
          ((item as Record<string, unknown>).title as string).trim().length > 0,
      )
    : [];
  if (documents.length === 0) {
    return { error: 'List at least one requested document.' };
  }

  const dueDate =
    typeof args.dueDate === 'string' && DATE_ONLY_PATTERN.test(args.dueDate)
      ? new Date(`${args.dueDate}T00:00:00.000Z`)
      : null;

  try {
    const created = await createDocumentRequests(
      new Types.ObjectId(clientId),
      documents.slice(0, 20).map((item) => ({
        title: item.title.trim().slice(0, 200),
        documentType: documentTypeFrom(item.documentType),
        dueDate,
      })),
      user,
      context.actor,
    );
    return {
      created: true,
      requestId: created[0]?._id.toString() ?? null,
      title: created[0]?.title ?? title,
      documentCount: created.length,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'The request could not be created.' };
  }
};

const tool_listDocumentRequests = async (
  user: AuthenticatedUser,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const clientId = asString(args.clientId);
  const status =
    args.status === 'open' || args.status === 'fulfilled' || args.status === 'cancelled'
      ? args.status
      : undefined;
  const overdue = args.overdue === true;
  const limit =
    typeof args.limit === 'number' && Number.isFinite(args.limit)
      ? Math.min(Math.max(Math.trunc(args.limit), 1), 50)
      : 20;

  const { items, total } = await listDocumentRequests(
    user,
    {
      client: clientId && OBJECT_ID_PATTERN.test(clientId) ? clientId : undefined,
      status,
      overdue,
    },
    toPageRequest(1, limit),
  );

  return {
    total,
    requests: items.map((req) => ({
      id: req._id.toString(),
      title: req.title,
      status: req.status,
      documentType: req.documentType,
      dueDate: formatDisplayDate(req.dueDate),
      clientName: namedOf(req.client, 'displayName') ?? 'Client',
      reminderCount: req.reminderCount,
    })),
  };
};

const tool_cancelDocumentRequest = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  if (user.role === 'client') {
    return { error: 'Client portal accounts cannot cancel document requests.' };
  }
  const requestId = asString(args.requestId);
  if (!requestId || !OBJECT_ID_PATTERN.test(requestId)) {
    return { error: 'A valid 24-character requestId is required.' };
  }
  try {
    const cancelled = await cancelDocumentRequest(new Types.ObjectId(requestId), context.actor);
    return { cancelled: true, requestId: cancelled._id.toString(), title: cancelled.title };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not cancel document request.' };
  }
};

const tool_sendDocumentReminder = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  if (user.role === 'client') {
    return { error: 'Client portal accounts cannot send document reminders.' };
  }
  const requestId = asString(args.requestId);
  if (!requestId || !OBJECT_ID_PATTERN.test(requestId)) {
    return { error: 'A valid 24-character requestId is required.' };
  }
  try {
    const res = await sendManualReminder(new Types.ObjectId(requestId), user, context.actor);
    return { sent: true, recipientCount: res.sent, requestId };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not send reminder.' };
  }
};

const tool_listClientDocuments = async (
  user: AuthenticatedUser,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const clientId = asString(args.clientId);
  if (!clientId || !OBJECT_ID_PATTERN.test(clientId)) {
    return { error: 'A valid 24-character clientId is required.' };
  }
  const documentType = DOCUMENT_TYPES.includes(args.documentType as DocumentType)
    ? (args.documentType as DocumentType)
    : undefined;
  const q = asString(args.query)?.trim();
  const limit =
    typeof args.limit === 'number' && Number.isFinite(args.limit)
      ? Math.min(Math.max(Math.trunc(args.limit), 1), 50)
      : 20;

  const { items, total } = await listDocuments(
    user,
    { client: clientId, documentType, q },
    toPageRequest(1, limit),
  );

  return {
    total,
    documents: items.map((doc) => ({
      id: doc._id.toString(),
      title: doc.title,
      documentType: doc.documentType,
      currentVersion: doc.currentVersion,
      createdAt: formatDisplayDate(doc.createdAt),
    })),
  };
};

// 5. Client Communications
const tool_sendClientMessage = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const clientId = asString(args.clientId);
  const message = asString(args.message)?.trim();
  if (!clientId || !OBJECT_ID_PATTERN.test(clientId) || !message || message.length === 0) {
    return { error: 'A valid clientId and message text are required.' };
  }
  try {
    const created = await postMessage(
      new Types.ObjectId(clientId),
      { body: message.slice(0, 4000) },
      context.user,
      context.actor,
    );
    return {
      sent: true,
      messageId: created._id.toString(),
      clientId,
      preview: message.slice(0, 100),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not send message.' };
  }
};

const tool_listClientMessages = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const clientId = asString(args.clientId);
  if (!clientId || !OBJECT_ID_PATTERN.test(clientId)) {
    return { error: 'A valid 24-character clientId is required.' };
  }
  const limit =
    typeof args.limit === 'number' && Number.isFinite(args.limit)
      ? Math.min(Math.max(Math.trunc(args.limit), 1), 30)
      : 10;
  try {
    const { items, total } = await listMessages(
      new Types.ObjectId(clientId),
      context.user,
      toPageRequest(1, limit),
    );
    return {
      total,
      messages: items.map((m) => ({
        id: m._id.toString(),
        authorName: namedOf(m.author, 'name') ?? 'User',
        authorRole: m.authorRole,
        body: m.body,
        createdAt: formatDisplayDate(m.createdAt),
      })),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not fetch messages.' };
  }
};

// 6. Team & Staff Management
const tool_listTeamMembers = async (
  _context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const role = args.role === 'admin' || args.role === 'staff' ? args.role : undefined;
  const { items, total } = await listUsers(
    { role, status: 'active' },
    toPageRequest(1, 50),
  );
  return {
    total,
    team: items
      .filter((u) => u.role === 'admin' || u.role === 'staff')
      .map((u) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
      })),
  };
};

// 7. Firm Settings
const tool_getFirmSettings = async (): Promise<unknown> => {
  const settings = await getFirmSettings();
  return {
    firmName: settings.firmName,
    contactEmail: settings.contactEmail,
    contactPhone: settings.contactPhone,
    address: settings.address,
    complianceHorizonDays: settings.complianceHorizonDays,
    defaultReminderOffsetsDays: settings.defaultReminderOffsetsDays,
  };
};

const tool_updateFirmSettings = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  if (context.user.role !== 'admin') {
    return { error: 'Only firm administrators can update firm settings.' };
  }
  const update: Record<string, unknown> = {};
  if (asString(args.firmName)) update.firmName = asString(args.firmName)!.trim();
  if (asString(args.contactEmail)) update.contactEmail = asString(args.contactEmail)!.trim();
  if (asString(args.contactPhone)) update.contactPhone = asString(args.contactPhone)!.trim();
  if (typeof args.complianceHorizonDays === 'number') {
    update.complianceHorizonDays = Math.min(Math.max(Math.trunc(args.complianceHorizonDays), 7), 365);
  }
  try {
    const updated = await updateFirmSettings(update, context.actor);
    return {
      updated: true,
      firmName: updated.firmName,
      contactEmail: updated.contactEmail,
      contactPhone: updated.contactPhone,
      complianceHorizonDays: updated.complianceHorizonDays,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not update firm settings.' };
  }
};

// 8. Reports & Analytics
const tool_getFirmSummary = async (user: AuthenticatedUser): Promise<unknown> => {
  const summary = await dashboardSummary(user);
  return { ...summary, today: formatDisplayDate(todayIST()) };
};

const tool_getComplianceReport = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const category = COMPLIANCE_CATEGORIES.includes(args.category as ComplianceCategory)
    ? (args.category as ComplianceCategory)
    : undefined;
  const status = COMPLIANCE_STATUSES.includes(args.status as ComplianceStatus)
    ? (args.status as ComplianceStatus)
    : undefined;
  const clientId = asString(args.clientId);

  const report = await complianceReport(context.user, {
    category,
    status,
    client: clientId && OBJECT_ID_PATTERN.test(clientId) ? clientId : undefined,
  });

  return {
    totals: report.totals,
    sampleRows: report.rows.slice(0, 15).map((r) => ({
      clientName: r.clientName,
      filingName: r.complianceTypeName,
      periodLabel: r.periodLabel,
      dueDate: formatDisplayDate(r.dueDate),
      status: r.status,
      isOverdue: r.isOverdue,
      assignedStaff: r.assignedStaffName,
    })),
  };
};

const tool_getTeamWorkloadReport = async (context: AgentContext): Promise<unknown> => {
  const rows = await workloadReport(context.user, {});
  return {
    teamWorkload: rows.map((r) => ({
      staffName: r.staffName,
      openTasks: r.openTasks,
      overdueTasks: r.overdueTasks,
      completedTasks: r.completedTasks,
      openFilings: r.openFilings,
      overdueFilings: r.overdueFilings,
    })),
  };
};

const tool_getClientRosterReport = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const clientId = asString(args.clientId);
  const rows = await rosterReport(context.user, {
    client: clientId && OBJECT_ID_PATTERN.test(clientId) ? clientId : undefined,
  });
  return {
    count: rows.length,
    roster: rows.slice(0, 15).map((r) => ({
      displayName: r.displayName,
      clientType: r.clientType,
      status: r.status,
      services: r.services,
      assignedStaff: r.assignedStaff,
      nextDueDate: formatDisplayDate(r.nextDueDate),
      openRequests: r.openRequests,
    })),
  };
};

// 9. Client Services & Subscriptions
const tool_addClientService = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  if (user.role === 'client') {
    return { error: 'Client portal accounts cannot attach client services.' };
  }
  const clientId = asString(args.clientId);
  if (!clientId || !OBJECT_ID_PATTERN.test(clientId)) {
    return { error: 'A valid 24-character clientId is required.' };
  }
  let complianceTypeId = asString(args.complianceTypeId);
  if (!complianceTypeId || !OBJECT_ID_PATTERN.test(complianceTypeId)) {
    const searchName = asString(args.complianceTypeName) || complianceTypeId;
    if (searchName) {
      const found = await ComplianceType.findOne({
        $or: [
          { name: new RegExp(escapeRegex(searchName.trim()), 'i') },
          { code: new RegExp(escapeRegex(searchName.trim()), 'i') },
        ],
        active: true,
      }).lean();
      if (found) {
        complianceTypeId = found._id.toString();
      }
    }
  }
  if (!complianceTypeId || !OBJECT_ID_PATTERN.test(complianceTypeId)) {
    return { error: 'A valid complianceTypeId (or complianceTypeName) is required.' };
  }

  const startDateStr = asString(args.startDate);
  const startDate =
    startDateStr && DATE_ONLY_PATTERN.test(startDateStr)
      ? new Date(`${startDateStr}T00:00:00.000Z`)
      : todayIST();

  const freq = FREQUENCIES.includes(args.frequency as Frequency)
    ? (args.frequency as Frequency)
    : undefined;
  const staffId = asString(args.assignedStaffId);
  const assignedStaff = staffId && OBJECT_ID_PATTERN.test(staffId) ? staffId : undefined;

  try {
    const created = await createClientService(
      new Types.ObjectId(clientId),
      {
        complianceTypeId,
        startDate,
        frequency: freq,
        assignedStaff,
      },
      context.actor,
    );
    return {
      success: true,
      serviceId: created._id.toString(),
      serviceName: (created.complianceType as { name?: string })?.name ?? 'Statutory Service',
      category: (created.complianceType as { category?: string })?.category ?? 'compliance',
      startDate: formatDisplayDate(created.startDate),
      frequency: created.frequency,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not add client service.' };
  }
};

const tool_listClientServices = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const clientId = asString(args.clientId);
  if (!clientId || !OBJECT_ID_PATTERN.test(clientId)) {
    return { error: 'A valid 24-character clientId is required.' };
  }
  const scoped = await accessibleClientIds(context.user);
  if (scoped !== null && !scoped.some((id) => id.toString() === clientId)) {
    return { error: 'You do not have access to that client.' };
  }
  try {
    const services = await listClientServices(new Types.ObjectId(clientId));
    return {
      count: services.length,
      services: services.map((s) => ({
        id: s._id.toString(),
        name: (s.complianceType as { name?: string })?.name ?? 'Service',
        category: (s.complianceType as { category?: string })?.category,
        frequency: s.frequency,
        active: s.active,
        startDate: formatDisplayDate(s.startDate),
        endDate: formatDisplayDate(s.endDate),
        assignedStaff: (s.assignedStaff as { name?: string })?.name ?? null,
      })),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not list client services.' };
  }
};

const tool_deleteClientService = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  if (user.role !== 'admin') {
    return { error: 'Only administrators can remove client services.' };
  }
  const serviceId = asString(args.serviceId);
  if (!serviceId || !OBJECT_ID_PATTERN.test(serviceId)) {
    return { error: 'A valid 24-character serviceId is required.' };
  }
  try {
    await deleteClientService(new Types.ObjectId(serviceId), context.actor);
    return { success: true, serviceId, deleted: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not remove client service.' };
  }
};

// 10. Manual Compliance Filing Creation
const tool_createComplianceFiling = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  if (user.role === 'client') {
    return { error: 'Client portal accounts cannot create compliance filings.' };
  }
  const clientId = asString(args.clientId);
  if (!clientId || !OBJECT_ID_PATTERN.test(clientId)) {
    return { error: 'A valid 24-character clientId is required.' };
  }
  let complianceTypeId = asString(args.complianceTypeId);
  if (!complianceTypeId || !OBJECT_ID_PATTERN.test(complianceTypeId)) {
    const searchName = asString(args.complianceTypeName) || complianceTypeId;
    if (searchName) {
      const found = await ComplianceType.findOne({
        $or: [
          { name: new RegExp(escapeRegex(searchName.trim()), 'i') },
          { code: new RegExp(escapeRegex(searchName.trim()), 'i') },
        ],
        active: true,
      }).lean();
      if (found) complianceTypeId = found._id.toString();
    }
  }
  if (!complianceTypeId || !OBJECT_ID_PATTERN.test(complianceTypeId)) {
    return { error: 'A valid complianceTypeId is required.' };
  }

  const periodType = PERIOD_TYPES.includes(args.periodType as PeriodType)
    ? (args.periodType as PeriodType)
    : 'month';

  const anchorStr = asString(args.periodAnchor);
  const periodAnchor =
    anchorStr && DATE_ONLY_PATTERN.test(anchorStr)
      ? new Date(`${anchorStr}T00:00:00.000Z`)
      : todayIST();

  const dueDateStr = asString(args.dueDate);
  const dueDate =
    dueDateStr && DATE_ONLY_PATTERN.test(dueDateStr)
      ? new Date(`${dueDateStr}T00:00:00.000Z`)
      : undefined;

  const staffId = asString(args.assignedStaffId);
  const assignedStaff = staffId && OBJECT_ID_PATTERN.test(staffId) ? staffId : undefined;
  const notes = asString(args.notes);

  try {
    const item = await createComplianceItem(
      {
        clientId: new Types.ObjectId(clientId),
        complianceTypeId,
        periodType,
        periodAnchor,
        dueDate,
        assignedStaff,
        notes,
      },
      context.actor,
    );
    return {
      success: true,
      filingId: item._id.toString(),
      filingName: (item.complianceType as { name?: string })?.name ?? 'Filing',
      periodLabel: item.periodLabel,
      dueDate: formatDisplayDate(item.dueDate),
      status: item.status,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not create compliance filing.' };
  }
};

// 11. Autonomous Practice Automation Runner
const tool_runAutonomousPracticeAutomation = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  if (user.role === 'client') {
    return { error: 'Client portal accounts cannot run practice automation.' };
  }
  const horizonDays =
    typeof args.horizonDays === 'number' && Number.isFinite(args.horizonDays)
      ? Math.min(Math.max(args.horizonDays, 7), 90)
      : 30;
  const quarterDays =
    typeof args.quarterDays === 'number' && Number.isFinite(args.quarterDays)
      ? Math.min(Math.max(args.quarterDays, 30), 180)
      : 90;
  const urgentDays =
    typeof args.urgentDays === 'number' && Number.isFinite(args.urgentDays)
      ? Math.min(Math.max(args.urgentDays, 3), 30)
      : 10;

  const today = todayIST();
  const nextFriday = new Date(today);
  const dayOfWeek = nextFriday.getUTCDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
  nextFriday.setUTCDate(nextFriday.getUTCDate() + daysUntilFriday);

  const scoped = await accessibleClientIds(user);
  const clientFilter = scoped === null ? {} : { client: { $in: scoped } };
  const openFilter = { ...clientFilter, status: { $nin: CLOSED_COMPLIANCE_STATUSES } };

  // 1. Deadlines
  const [overdueFilings, upcomingFilings] = await Promise.all([
    ComplianceItem.find({ ...openFilter, dueDate: { $lt: today } })
      .populate('client', 'displayName')
      .populate('complianceType', 'name category')
      .sort({ dueDate: 1 })
      .lean()
      .exec(),
    ComplianceItem.find({ ...openFilter, dueDate: { $gte: today, $lte: addDays(today, horizonDays) } })
      .populate('client', 'displayName')
      .populate('complianceType', 'name category')
      .sort({ dueDate: 1 })
      .lean()
      .exec(),
  ]);

  // 2. Bulk filing generation
  let bulkGenResult = { created: 0, skipped: 0, requestsCreated: 0 };
  if (user.role === 'admin') {
    try {
      const plan = await planFromClientServices(today, addDays(today, quarterDays));
      bulkGenResult = await commitPlan(plan, 'bulk', context.actor);
    } catch {
      // Non-fatal
    }
  }

  // 3. Urgent Task Creation
  const criticalFilings = await ComplianceItem.find({
    ...openFilter,
    dueDate: { $lte: addDays(today, urgentDays) },
  })
    .populate('client', 'displayName assignedStaff')
    .populate('complianceType', 'name category')
    .lean()
    .exec();

  let tasksCreated = 0;
  for (const filing of criticalFilings) {
    const clientName = (filing.client as { displayName?: string })?.displayName || 'Client';
    const filingName = (filing.complianceType as { name?: string })?.name || 'Statutory Return';
    const taskTitle = `Urgent Review: ${filingName} - ${clientName}`;

    const existing = await Task.findOne({
      client: filing.client,
      title: taskTitle,
      status: { $ne: 'done' },
    }).lean().exec();

    if (!existing) {
      const assignedStaff = (filing.client as { assignedStaff?: unknown[] })?.assignedStaff;
      const assigneeId =
        Array.isArray(assignedStaff) && assignedStaff.length > 0 && assignedStaff[0]
          ? (assignedStaff[0] as Types.ObjectId)
          : context.user.id;

      await Task.create({
        title: taskTitle,
        description: `Automated urgent review task for ${filingName} (Due: ${formatDisplayDate(filing.dueDate)}). Please verify input documents, compute tax liability, and prepare return.`,
        client: (filing.client as { _id?: Types.ObjectId })?._id,
        assignee: assigneeId,
        dueDate: nextFriday,
        priority: 'high',
        status: 'not_started',
        complianceItem: filing._id,
        internalOnly: true,
        checklist: [
          { _id: new Types.ObjectId(), title: 'Verify client input documents & receipts', done: false },
          { _id: new Types.ObjectId(), title: 'Reconcile 2B/TDS challans and compute liability', done: false },
          { _id: new Types.ObjectId(), title: 'Partner final sign-off & portal filing', done: false },
        ],
        loggedMinutes: 0,
        attachments: [],
        blockedBy: [],
        createdBy: context.user.id,
      });
      tasksCreated += 1;
    }
  }

  // 4. Summaries
  const [dashboard, workload] = await Promise.all([
    dashboardSummary(user),
    workloadReport(user, {}),
  ]);

  return {
    success: true,
    deadlines: {
      overdueCount: overdueFilings.length,
      upcomingCount: upcomingFilings.length,
      overdueList: overdueFilings.slice(0, 10).map((f) => ({
        client: (f.client as { displayName?: string })?.displayName,
        filing: (f.complianceType as { name?: string })?.name,
        due: formatDisplayDate(f.dueDate),
      })),
      upcomingList: upcomingFilings.slice(0, 10).map((f) => ({
        client: (f.client as { displayName?: string })?.displayName,
        filing: (f.complianceType as { name?: string })?.name,
        due: formatDisplayDate(f.dueDate),
      })),
    },
    bulkGeneration: bulkGenResult,
    tasksCreated,
    practiceSummary: {
      activeClients: dashboard.clientCount,
      openDocumentRequests: dashboard.openRequests,
      overdueFilings: dashboard.overdueFilings,
      dueIn7Days: dashboard.dueIn7,
      dueIn30Days: dashboard.dueIn30,
      tasksByStatus: dashboard.tasksByStatus,
    },
    teamCapacity: workload.map((w) => ({
      staffName: w.staffName,
      openTasks: w.openTasks,
      overdueTasks: w.overdueTasks,
      openFilings: w.openFilings,
    })),
  };
};

// 12. User & Portal Management
const tool_updateUserRole = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  if (user.role !== 'admin') {
    return { error: 'Only firm administrators can change user roles.' };
  }
  const userId = asString(args.userId);
  if (!userId || !OBJECT_ID_PATTERN.test(userId)) {
    return { error: 'A valid 24-character userId is required.' };
  }
  const role = args.role as Role;
  if (!ROLES.includes(role)) {
    return { error: `Invalid role. Must be one of: ${ROLES.join(', ')}.` };
  }
  try {
    const updated = await changeRole(new Types.ObjectId(userId), role, context.actor);
    return {
      success: true,
      userId: updated._id.toString(),
      email: updated.email,
      name: updated.name,
      role: updated.role,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not change user role.' };
  }
};

const tool_linkClientUser = async (
  context: AgentContext,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const user = context.user;
  if (user.role !== 'admin') {
    return { error: 'Only firm administrators can link client portal users.' };
  }
  const userId = asString(args.userId);
  if (!userId || !OBJECT_ID_PATTERN.test(userId)) {
    return { error: 'A valid 24-character userId is required.' };
  }
  const clientIds = Array.isArray(args.clientIds)
    ? args.clientIds.filter((id): id is string => typeof id === 'string' && OBJECT_ID_PATTERN.test(id))
    : [];
  try {
    const updated = await setLinkedClients(new Types.ObjectId(userId), clientIds, context.actor);
    return {
      success: true,
      userId: updated._id.toString(),
      email: updated.email,
      linkedClientCount: updated.linkedClients.length,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not link client to user.' };
  }
};

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------

interface ToolSpec {
  name: ToolName;
  description: string;
  parameters: Record<string, unknown>;
  badge: (result: unknown) => string;
  run: (context: AgentContext, args: Record<string, unknown>) => Promise<unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

const countFrom = (result: unknown, keys: string[]): number | null => {
  if (!isRecord(result)) return null;
  for (const key of keys) {
    const value = result[key];
    if (typeof value === 'number') return value;
    if (Array.isArray(value)) return value.length;
  }
  return null;
};

const CLIENT_OF_ROUTE = /\/clients\/([a-f\d]{24})/i;

const CLIENT_ROUTE_TOOLS = new Set<string>([
  TOOL_NAMES.complianceFilings,
  TOOL_NAMES.createTask,
  TOOL_NAMES.createDocumentRequest,
  TOOL_NAMES.getClientDetails,
  TOOL_NAMES.updateClient,
  TOOL_NAMES.archiveClient,
  TOOL_NAMES.listTasks,
  TOOL_NAMES.listDocumentRequests,
  TOOL_NAMES.listClientDocuments,
  TOOL_NAMES.sendClientMessage,
  TOOL_NAMES.listClientMessages,
  TOOL_NAMES.getComplianceReport,
  TOOL_NAMES.getClientRosterReport,
  TOOL_NAMES.addClientService,
  TOOL_NAMES.listClientServices,
  TOOL_NAMES.createComplianceFiling,
  TOOL_NAMES.prepareFilingReturn,
  TOOL_NAMES.getFilingGuide,
  TOOL_NAMES.updateFilingGuideStep,
]);

const withRouteContext = (
  context: AgentContext,
  name: ToolName,
  args: Record<string, unknown>,
): Record<string, unknown> => {
  if (context.currentRoute === null) return args;
  const match = CLIENT_OF_ROUTE.exec(context.currentRoute);
  const routeClient = match === null ? null : (match[1] ?? null);
  if (routeClient === null) return args;
  if (CLIENT_ROUTE_TOOLS.has(name) && args.clientId === undefined && context.user.role !== 'client') {
    return { ...args, clientId: routeClient };
  }
  return args;
};

const TOOLS: readonly ToolSpec[] = [
  // 1. Clients
  {
    name: TOOL_NAMES.searchClients,
    description:
      "Search the firm's client directory by name, PAN or GSTIN. Returns matching clients with their ids.",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search text: client name, PAN or GSTIN fragment.' },
        status: { type: 'string', description: 'Optional filter: onboarding, active or inactive.' },
      },
    },
    badge: (result) => {
      const count = countFrom(result, ['total', 'clients']);
      return count === null
        ? 'Checked client directory'
        : `Searched clients (${count} match${count === 1 ? '' : 'es'})`;
    },
    run: (context, args) => tool_searchClients(context.user, args),
  },
  {
    name: TOOL_NAMES.createClient,
    description:
      'Create a new client in FirmDesk. Firm users only (admin/staff). Sets up PAN, GSTIN, contacts, and initial details.',
    parameters: {
      type: 'object',
      properties: {
        displayName: { type: 'string', description: 'Trade or business name of the client.' },
        legalName: { type: 'string', description: 'Legal registration name if different.' },
        clientType: { type: 'string', description: 'One of: individual, business.' },
        pan: { type: 'string', description: '10-character PAN number.' },
        gstin: { type: 'string', description: '15-character GSTIN.' },
        tan: { type: 'string', description: 'TAN number for TDS deduction.' },
        cin: { type: 'string', description: 'CIN for corporate companies.' },
        email: { type: 'string', description: 'Primary contact email.' },
        phone: { type: 'string', description: 'Primary contact phone number.' },
        address: { type: 'string', description: 'Business or registered address.' },
        city: { type: 'string', description: 'City name.' },
        state: { type: 'string', description: 'State name.' },
        pincode: { type: 'string', description: 'Postal pincode.' },
        notes: { type: 'string', description: 'Internal practice notes.' },
        status: { type: 'string', description: 'One of: onboarding, active.' },
      },
      required: ['displayName'],
    },
    badge: (result) =>
      isRecord(result) && result.created === true && typeof result.displayName === 'string'
        ? `Created client ${result.displayName}`
        : 'Attempted client creation',
    run: (context, args) => tool_createClient(context, args),
  },
  {
    name: TOOL_NAMES.updateClient,
    description:
      'Update existing client profile in FirmDesk: name, status (onboarding/active/inactive), PAN, GSTIN, contacts, or notes.',
    parameters: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'The 24-character client id to update.' },
        displayName: { type: 'string', description: 'Updated client display name.' },
        legalName: { type: 'string', description: 'Updated legal name.' },
        status: { type: 'string', description: 'One of: onboarding, active, inactive.' },
        pan: { type: 'string', description: 'PAN number.' },
        gstin: { type: 'string', description: 'GSTIN.' },
        tan: { type: 'string', description: 'TAN number.' },
        cin: { type: 'string', description: 'CIN number.' },
        email: { type: 'string', description: 'Primary contact email.' },
        phone: { type: 'string', description: 'Primary contact phone.' },
        notes: { type: 'string', description: 'Practice notes.' },
      },
      required: ['clientId'],
    },
    badge: (result) =>
      isRecord(result) && result.updated === true && typeof result.displayName === 'string'
        ? `Updated client ${result.displayName}`
        : 'Attempted client update',
    run: (context, args) => tool_updateClient(context, withRouteContext(context, TOOL_NAMES.updateClient, args)),
  },
  {
    name: TOOL_NAMES.getClientDetails,
    description:
      'Fetch full client profile by clientId, including contact details, tax numbers (PAN/GSTIN), address, and assigned staff.',
    parameters: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'The 24-character client id.' },
      },
      required: ['clientId'],
    },
    badge: (result) =>
      isRecord(result) && typeof result.displayName === 'string'
        ? `Fetched profile of ${result.displayName}`
        : 'Checked client profile',
    run: (context, args) =>
      tool_getClientDetails(context, withRouteContext(context, TOOL_NAMES.getClientDetails, args)),
  },
  {
    name: TOOL_NAMES.archiveClient,
    description: 'Archive or restore a client from practice records. Firm users only.',
    parameters: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'The 24-character client id.' },
        archived: { type: 'boolean', description: 'True to archive, false to restore.' },
      },
      required: ['clientId'],
    },
    badge: (result) =>
      isRecord(result) && result.archived === true ? 'Archived client' : 'Restored client',
    run: (context, args) => tool_archiveClient(context, withRouteContext(context, TOOL_NAMES.archiveClient, args)),
  },

  // 2. Compliance & Statutory Filings
  {
    name: TOOL_NAMES.complianceFilings,
    description:
      'List statutory filings (GSTR, TDS, ITR etc.) for the whole firm or one client. Filter by category (gst, income_tax, tds, roc, advisory, other) or status (pending, in_progress, awaiting_client, filed, acknowledged, not_applicable).',
    parameters: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'Optional 24-character client id to restrict to one client.' },
        category: {
          type: 'string',
          description: 'One of: gst, income_tax, tds, roc, advisory, other.',
        },
        status: {
          type: 'string',
          description: 'One of: pending, in_progress, awaiting_client, filed, acknowledged, not_applicable.',
        },
        limit: { type: 'integer', description: 'Maximum filings to return, 1 to 50.' },
      },
    },
    badge: (result) => {
      const count = countFrom(result, ['count', 'filings']);
      return count === null ? 'Checked statutory filings' : `Checked ${count} filing${count === 1 ? '' : 's'}`;
    },
    run: (context, args) =>
      tool_getComplianceFilings(context.user, withRouteContext(context, TOOL_NAMES.complianceFilings, args)),
  },
  {
    name: TOOL_NAMES.updateFilingStatus,
    description:
      'Update the status of a statutory compliance filing (e.g. mark as filed, in_progress, awaiting_client, acknowledged, not_applicable). Can record filed date and acknowledgement/ARN reference.',
    parameters: {
      type: 'object',
      properties: {
        filingId: { type: 'string', description: 'The 24-character filing id.' },
        status: {
          type: 'string',
          description: 'One of: pending, in_progress, awaiting_client, filed, acknowledged, not_applicable.',
        },
        filedDate: { type: 'string', description: 'Date filed as YYYY-MM-DD. Defaults to today if marking filed.' },
        acknowledgementRef: { type: 'string', description: 'ARN, challan number or acknowledgement reference.' },
        notApplicableReason: { type: 'string', description: 'Reason why this filing does not apply if status is not_applicable.' },
      },
      required: ['filingId', 'status'],
    },
    badge: (result) =>
      isRecord(result) && result.updated === true && typeof result.status === 'string'
        ? `Updated filing status to ${result.status}`
        : 'Attempted filing status update',
    run: (context, args) => tool_updateFilingStatus(context, args),
  },
  {
    name: TOOL_NAMES.updateFiling,
    description:
      'Update filing details: override due date, assign a staff member, or update internal filing notes.',
    parameters: {
      type: 'object',
      properties: {
        filingId: { type: 'string', description: 'The 24-character filing id.' },
        dueDate: { type: 'string', description: 'New due date as YYYY-MM-DD.' },
        assignedStaffId: { type: 'string', description: '24-character user id of assigned staff.' },
        notes: { type: 'string', description: 'Filing notes.' },
        acknowledgementRef: { type: 'string', description: 'Acknowledgement or ARN reference.' },
      },
      required: ['filingId'],
    },
    badge: (result) =>
      isRecord(result) && result.updated === true ? 'Updated filing details' : 'Attempted filing update',
    run: (context, args) => tool_updateFiling(context, args),
  },
  {
    name: TOOL_NAMES.generateComplianceFilings,
    description:
      'Bulk-generate statutory compliance filings for all active clients across a date range. Admin only.',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Window start date as YYYY-MM-DD (e.g. 2026-04-01).' },
        endDate: { type: 'string', description: 'Window end date as YYYY-MM-DD (e.g. 2026-06-30).' },
        complianceTypeId: { type: 'string', description: 'Optional 24-character compliance type id to generate only one type.' },
      },
    },
    badge: (result) =>
      isRecord(result) && result.success === true && typeof result.created === 'number'
        ? `Generated ${result.created} filing(s)`
        : 'Attempted bulk generation',
    run: (context, args) => tool_generateComplianceFilings(context, args),
  },
  {
    name: TOOL_NAMES.listComplianceTypes,
    description:
      'List standard statutory compliance types (GSTR-1, GSTR-3B, TDS 24Q, TDS 26Q, ITR, MCA etc.) with their categories and schedules.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'One of: gst, income_tax, tds, roc, advisory, other.' },
        query: { type: 'string', description: 'Search by compliance name or code (e.g. GSTR, TDS, ITR).' },
      },
    },
    badge: (result) => {
      const count = countFrom(result, ['count', 'complianceTypes']);
      return count === null ? 'Checked compliance types' : `Listed ${count} compliance type${count === 1 ? '' : 's'}`;
    },
    run: (context, args) => tool_listComplianceTypes(context.user, args),
  },
  {
    name: TOOL_NAMES.upcomingDeadlines,
    description:
      'Statutory filings due within the next N days (default 14, max 90) plus overdue filings, for clients the user can access.',
    parameters: {
      type: 'object',
      properties: {
        horizonDays: { type: 'number', description: 'How many days ahead to look, 1 to 90.' },
      },
    },
    badge: (result) => {
      const count = countFrom(result, ['upcoming']);
      return count === null
        ? 'Checked upcoming deadlines'
        : `Checked ${count} upcoming deadline${count === 1 ? '' : 's'}`;
    },
    run: (context, args) => tool_getUpcomingDeadlines(context.user, args),
  },
  {
    name: TOOL_NAMES.prepareFilingReturn,
    description:
      'Autonomously prepare a statutory return (GSTR-1, GSTR-3B, GSTR-9, CMP-08, ITR, Advance Tax, TDS 24Q/26Q, ROC AOC-4/MGT-7) from the documents already uploaded against the filing. Computes the tax liability, builds the portal-ready payload, and generates the step-by-step government portal filing guide. If required inputs are missing it lists exactly what is needed so document requests can be raised.',
    parameters: {
      type: 'object',
      properties: {
        filingId: { type: 'string', description: 'The 24-character compliance filing id.' },
      },
      required: ['filingId'],
    },
    badge: (result) =>
      isRecord(result) && result.success === true && typeof result.form === 'string'
        ? `Prepared ${result.form} return`
        : 'Attempted return preparation',
    run: (context, args) => tool_prepareFilingReturn(context, args),
  },
  {
    name: TOOL_NAMES.getFilingGuide,
    description:
      'Fetch the guided, step-by-step instructions for filing a prepared return on its government portal (GST Portal, Income Tax Portal, TRACES or MCA V3), including which figures to enter where, how to pay tax, and where to note the ARN/acknowledgement. Requires the return to have been prepared first.',
    parameters: {
      type: 'object',
      properties: {
        filingId: { type: 'string', description: 'The 24-character compliance filing id.' },
      },
      required: ['filingId'],
    },
    badge: (result) =>
      isRecord(result) && typeof result.form === 'string'
        ? `Loaded ${result.form} filing guide`
        : 'Attempted to load filing guide',
    run: (context, args) => tool_getFilingGuide(context, args),
  },
  {
    name: TOOL_NAMES.updateFilingGuideStep,
    description:
      'Mark a guided filing step as done or not done (e.g. after logging into the portal or making the payment) to track portal filing progress.',
    parameters: {
      type: 'object',
      properties: {
        filingId: { type: 'string', description: 'The 24-character compliance filing id.' },
        stepNumber: { type: 'integer', description: 'The 1-based step number from the guide.' },
        done: { type: 'boolean', description: 'True marks the step done. Defaults to true.' },
      },
      required: ['filingId', 'stepNumber'],
    },
    badge: (result) =>
      isRecord(result) && result.success === true && typeof result.stepNumber === 'number'
        ? `Updated guide step ${result.stepNumber}`
        : 'Attempted guide step update',
    run: (context, args) => tool_updateFilingGuideStep(context, args),
  },

  // 3. Tasks & Workflow
  {
    name: TOOL_NAMES.createTask,
    description:
      'Create a work task in FirmDesk. Firm users only (admin/staff). Can be assigned to self or a team member.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short task title, 3 to 200 characters.' },
        priority: { type: 'string', description: 'One of: low, normal, high, urgent.' },
        dueDate: { type: 'string', description: 'Due date as YYYY-MM-DD.' },
        clientId: { type: 'string', description: 'Optional 24-character client id to link the task.' },
        assigneeId: { type: 'string', description: 'Optional 24-character staff/admin user id to assign.' },
        description: { type: 'string', description: 'Optional longer description.' },
      },
      required: ['title'],
    },
    badge: (result) =>
      isRecord(result) && result.created === true ? 'Created task' : 'Attempted task creation',
    run: (context, args) => tool_createTask(context, withRouteContext(context, TOOL_NAMES.createTask, args)),
  },
  {
    name: TOOL_NAMES.listTasks,
    description:
      'List tasks in FirmDesk. Filter by status (not_started, in_progress, review, done), priority, client, or search text.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'One of: not_started, in_progress, review, done.' },
        priority: { type: 'string', description: 'One of: low, normal, high, urgent.' },
        clientId: { type: 'string', description: 'Optional 24-character client id.' },
        query: { type: 'string', description: 'Search keyword in task title.' },
        overdue: { type: 'boolean', description: 'Set true to filter overdue tasks only.' },
        limit: { type: 'integer', description: 'Maximum tasks to return (1 to 50).' },
      },
    },
    badge: (result) => {
      const count = countFrom(result, ['total', 'tasks']);
      return count === null ? 'Checked tasks' : `Checked ${count} task${count === 1 ? '' : 's'}`;
    },
    run: (context, args) => tool_listTasks(context.user, withRouteContext(context, TOOL_NAMES.listTasks, args)),
  },
  {
    name: TOOL_NAMES.updateTask,
    description:
      'Update task details in FirmDesk: status (not_started, in_progress, review, done), priority, due date, title, or description.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The 24-character task id.' },
        status: { type: 'string', description: 'One of: not_started, in_progress, review, done.' },
        priority: { type: 'string', description: 'One of: low, normal, high, urgent.' },
        dueDate: { type: 'string', description: 'Due date as YYYY-MM-DD.' },
        title: { type: 'string', description: 'Updated title.' },
        description: { type: 'string', description: 'Updated description.' },
        assigneeId: { type: 'string', description: 'Reassign to another staff user id.' },
      },
      required: ['taskId'],
    },
    badge: (result) =>
      isRecord(result) && result.updated === true ? 'Updated task' : 'Attempted task update',
    run: (context, args) => tool_updateTask(context, args),
  },
  {
    name: TOOL_NAMES.assignTask,
    description: 'Reassign a task to a colleague/team member.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The 24-character task id.' },
        assigneeId: { type: 'string', description: 'The 24-character user id to assign.' },
      },
      required: ['taskId', 'assigneeId'],
    },
    badge: (result) =>
      isRecord(result) && result.reassigned === true ? 'Reassigned task' : 'Attempted reassignment',
    run: (context, args) => tool_assignTask(context, args),
  },
  {
    name: TOOL_NAMES.addTaskComment,
    description: 'Add an internal note or progress comment to a task.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The 24-character task id.' },
        comment: { type: 'string', description: 'Comment text.' },
      },
      required: ['taskId', 'comment'],
    },
    badge: (result) =>
      isRecord(result) && result.added === true ? 'Added task comment' : 'Attempted comment',
    run: (context, args) => tool_addTaskComment(context, args),
  },
  {
    name: TOOL_NAMES.deleteTask,
    description: 'Permanently delete a task from the system.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The 24-character task id.' },
      },
      required: ['taskId'],
    },
    badge: (result) =>
      isRecord(result) && result.deleted === true ? 'Deleted task' : 'Attempted task deletion',
    run: (context, args) => tool_deleteTask(context, args),
  },

  // 4. Document Requests & Documents
  {
    name: TOOL_NAMES.createDocumentRequest,
    description:
      'Raise document requests to a client (bank statements, GST data, invoices...). Firm users only (admin/staff).',
    parameters: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'The 24-character client id the request goes to.' },
        title: { type: 'string', description: 'Request title, 3 to 200 characters.' },
        requestedDocuments: {
          type: 'array',
          description:
            'Documents to request. Each entry: { "title": string, optional "documentType": one of purchase_invoice, sales_invoice, bank_statement, tax_document, income_proof, expense_document, audit_document, other }.',
          items: { type: 'object' },
        },
        dueDate: { type: 'string', description: 'Optional due date as YYYY-MM-DD.' },
      },
      required: ['clientId', 'title', 'requestedDocuments'],
    },
    badge: (result) => {
      if (isRecord(result) && result.created === true) {
        const count = typeof result.documentCount === 'number' ? result.documentCount : 1;
        return `Raised ${count} document request${count === 1 ? '' : 's'}`;
      }
      return 'Attempted document request';
    },
    run: (context, args) =>
      tool_createDocumentRequest(context, withRouteContext(context, TOOL_NAMES.createDocumentRequest, args)),
  },
  {
    name: TOOL_NAMES.listDocumentRequests,
    description: 'List document requests across clients. Filter by client, status (open, fulfilled, cancelled) or overdue.',
    parameters: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'Optional 24-character client id.' },
        status: { type: 'string', description: 'One of: open, fulfilled, cancelled.' },
        overdue: { type: 'boolean', description: 'Filter overdue requests only.' },
        limit: { type: 'integer', description: 'Max items to return (1 to 50).' },
      },
    },
    badge: (result) => {
      const count = countFrom(result, ['total', 'requests']);
      return count === null ? 'Checked document requests' : `Checked ${count} request${count === 1 ? '' : 's'}`;
    },
    run: (context, args) =>
      tool_listDocumentRequests(context.user, withRouteContext(context, TOOL_NAMES.listDocumentRequests, args)),
  },
  {
    name: TOOL_NAMES.cancelDocumentRequest,
    description: 'Cancel an open document request.',
    parameters: {
      type: 'object',
      properties: {
        requestId: { type: 'string', description: 'The 24-character request id.' },
      },
      required: ['requestId'],
    },
    badge: (result) =>
      isRecord(result) && result.cancelled === true ? 'Cancelled document request' : 'Attempted request cancellation',
    run: (context, args) => tool_cancelDocumentRequest(context, args),
  },
  {
    name: TOOL_NAMES.sendDocumentReminder,
    description: 'Trigger a reminder email to client contacts for an open document request.',
    parameters: {
      type: 'object',
      properties: {
        requestId: { type: 'string', description: 'The 24-character request id.' },
      },
      required: ['requestId'],
    },
    badge: (result) =>
      isRecord(result) && result.sent === true ? 'Sent document reminder email' : 'Attempted reminder',
    run: (context, args) => tool_sendDocumentReminder(context, args),
  },
  {
    name: TOOL_NAMES.listClientDocuments,
    description: 'List documents uploaded by or for a client. Filter by document type or search keyword.',
    parameters: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'The 24-character client id.' },
        documentType: {
          type: 'string',
          description:
            'One of: purchase_invoice, sales_invoice, bank_statement, tax_document, income_proof, expense_document, audit_document, other.',
        },
        query: { type: 'string', description: 'Search text in document titles.' },
        limit: { type: 'integer', description: 'Max items to return.' },
      },
      required: ['clientId'],
    },
    badge: (result) => {
      const count = countFrom(result, ['total', 'documents']);
      return count === null ? 'Checked client documents' : `Checked ${count} document${count === 1 ? '' : 's'}`;
    },
    run: (context, args) =>
      tool_listClientDocuments(context.user, withRouteContext(context, TOOL_NAMES.listClientDocuments, args)),
  },

  // 5. Client Communications
  {
    name: TOOL_NAMES.sendClientMessage,
    description: 'Post an official notice or message directly to a client in their portal communication thread.',
    parameters: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'The 24-character client id.' },
        message: { type: 'string', description: 'Message body to post.' },
      },
      required: ['clientId', 'message'],
    },
    badge: (result) =>
      isRecord(result) && result.sent === true ? 'Sent client message' : 'Attempted client message',
    run: (context, args) =>
      tool_sendClientMessage(context, withRouteContext(context, TOOL_NAMES.sendClientMessage, args)),
  },
  {
    name: TOOL_NAMES.listClientMessages,
    description: 'Read the recent communication thread and messages with a client.',
    parameters: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'The 24-character client id.' },
        limit: { type: 'integer', description: 'Max messages to return (1 to 30).' },
      },
      required: ['clientId'],
    },
    badge: (result) => {
      const count = countFrom(result, ['total', 'messages']);
      return count === null ? 'Checked client messages' : `Checked ${count} message${count === 1 ? '' : 's'}`;
    },
    run: (context, args) =>
      tool_listClientMessages(context, withRouteContext(context, TOOL_NAMES.listClientMessages, args)),
  },

  // 6. Team & Staff Management
  {
    name: TOOL_NAMES.listTeamMembers,
    description: 'List active practice team members (admins and staff) with their names, emails, roles, and user IDs.',
    parameters: {
      type: 'object',
      properties: {
        role: { type: 'string', description: 'Optional filter: admin or staff.' },
      },
    },
    badge: (result) => {
      const count = countFrom(result, ['total', 'team']);
      return count === null ? 'Checked team roster' : `Listed ${count} team member${count === 1 ? '' : 's'}`;
    },
    run: (context, args) => tool_listTeamMembers(context, args),
  },

  // 7. Firm Settings
  {
    name: TOOL_NAMES.getFirmSettings,
    description: 'Retrieve current firm settings: firm name, contact email, phone, address, and compliance horizon.',
    parameters: { type: 'object', properties: {} },
    badge: () => 'Read firm settings',
    run: () => tool_getFirmSettings(),
  },
  {
    name: TOOL_NAMES.updateFirmSettings,
    description: 'Update firm settings (firm name, contact email, phone, compliance horizon). Admin only.',
    parameters: {
      type: 'object',
      properties: {
        firmName: { type: 'string', description: 'Firm display name.' },
        contactEmail: { type: 'string', description: 'Primary firm email.' },
        contactPhone: { type: 'string', description: 'Primary firm phone number.' },
        complianceHorizonDays: { type: 'integer', description: 'Days ahead to track statutory filings (7 to 365).' },
      },
    },
    badge: (result) =>
      isRecord(result) && result.updated === true ? 'Updated firm settings' : 'Attempted settings update',
    run: (context, args) => tool_updateFirmSettings(context, args),
  },

  // 8. Reports & Analytics
  {
    name: TOOL_NAMES.firmSummary,
    description:
      'Firm dashboard summary: client count, tasks by status, filings due in 7/14/30 days, overdue filings, awaiting-client count, open document requests and team workload.',
    parameters: { type: 'object', properties: {} },
    badge: () => 'Pulled firm summary',
    run: (context) => tool_getFirmSummary(context.user),
  },
  {
    name: TOOL_NAMES.getComplianceReport,
    description:
      'Generate statutory compliance report with status breakdowns (pending, filed, overdue) and filing scorecard.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'One of: gst, income_tax, tds, roc, advisory, other.' },
        status: { type: 'string', description: 'One of: pending, in_progress, awaiting_client, filed, acknowledged, not_applicable.' },
        clientId: { type: 'string', description: 'Optional 24-character client id.' },
      },
    },
    badge: () => 'Generated compliance report',
    run: (context, args) =>
      tool_getComplianceReport(context, withRouteContext(context, TOOL_NAMES.getComplianceReport, args)),
  },
  {
    name: TOOL_NAMES.getTeamWorkloadReport,
    description: 'Generate team workload report: open tasks, overdue tasks, active filings, and workload by staff member.',
    parameters: { type: 'object', properties: {} },
    badge: () => 'Generated team workload report',
    run: (context) => tool_getTeamWorkloadReport(context),
  },
  {
    name: TOOL_NAMES.getClientRosterReport,
    description: 'Generate client practice roster report with active services, next due dates, and open requests.',
    parameters: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'Optional 24-character client id.' },
      },
    },
    badge: (result) => {
      const count = countFrom(result, ['count', 'roster']);
      return count === null ? 'Generated client roster' : `Generated roster for ${count} client${count === 1 ? '' : 's'}`;
    },
    run: (context, args) =>
      tool_getClientRosterReport(context, withRouteContext(context, TOOL_NAMES.getClientRosterReport, args)),
  },

  // 9. Client Services & Subscriptions
  {
    name: TOOL_NAMES.addClientService,
    description:
      'Attach a statutory compliance service (e.g. GSTR-1, GSTR-3B, TDS 26Q, ITR) to a client profile with start date and frequency.',
    parameters: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'The 24-character client id.' },
        complianceTypeId: { type: 'string', description: 'The 24-character compliance type id.' },
        complianceTypeName: { type: 'string', description: 'Or search by name/code (e.g. GSTR-3B, TDS, ITR).' },
        startDate: { type: 'string', description: 'Start date as YYYY-MM-DD. Defaults to today.' },
        frequency: { type: 'string', description: 'One of: monthly, quarterly, half_yearly, annual, one_time.' },
        assignedStaffId: { type: 'string', description: 'Optional 24-character staff user id.' },
      },
      required: ['clientId'],
    },
    badge: (result) =>
      isRecord(result) && result.success === true && typeof result.serviceName === 'string'
        ? `Added service ${result.serviceName}`
        : 'Attempted to add client service',
    run: (context, args) =>
      tool_addClientService(context, withRouteContext(context, TOOL_NAMES.addClientService, args)),
  },
  {
    name: TOOL_NAMES.listClientServices,
    description: 'List all statutory services and returns subscribed by a client.',
    parameters: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'The 24-character client id.' },
      },
      required: ['clientId'],
    },
    badge: (result) => {
      const count = countFrom(result, ['count', 'services']);
      return count === null ? 'Checked client services' : `Checked ${count} client service${count === 1 ? '' : 's'}`;
    },
    run: (context, args) =>
      tool_listClientServices(context, withRouteContext(context, TOOL_NAMES.listClientServices, args)),
  },
  {
    name: TOOL_NAMES.deleteClientService,
    description: 'Remove or deactivate a statutory service from a client. Admin only.',
    parameters: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: 'The 24-character client service id.' },
      },
      required: ['serviceId'],
    },
    badge: (result) =>
      isRecord(result) && result.success === true ? 'Removed client service' : 'Attempted to remove service',
    run: (context, args) => tool_deleteClientService(context, args),
  },

  // 10. Manual Compliance Filing Creation
  {
    name: TOOL_NAMES.createComplianceFiling,
    description:
      'Manually create a specific statutory compliance return filing for a client with due date, period anchor, and notes.',
    parameters: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'The 24-character client id.' },
        complianceTypeId: { type: 'string', description: 'The 24-character compliance type id.' },
        complianceTypeName: { type: 'string', description: 'Or search by compliance type name/code.' },
        periodType: { type: 'string', description: 'One of: month, quarter, half_year, financial_year.' },
        periodAnchor: { type: 'string', description: 'Date within the period as YYYY-MM-DD.' },
        dueDate: { type: 'string', description: 'Due date as YYYY-MM-DD.' },
        assignedStaffId: { type: 'string', description: 'Optional 24-character staff user id.' },
        notes: { type: 'string', description: 'Internal filing notes.' },
      },
      required: ['clientId'],
    },
    badge: (result) =>
      isRecord(result) && result.success === true && typeof result.filingName === 'string'
        ? `Created filing ${result.filingName}`
        : 'Attempted filing creation',
    run: (context, args) =>
      tool_createComplianceFiling(context, withRouteContext(context, TOOL_NAMES.createComplianceFiling, args)),
  },

  // 11. Autonomous Practice Automation Runner
  {
    name: TOOL_NAMES.runAutonomousPracticeAutomation,
    description:
      'Execute the full autonomous practice management and health check run: checks deadlines & overdue returns, bulk-generates statutory filings for the quarter, schedules high-priority review tasks for filings due in 10 days, and pulls team capacity.',
    parameters: {
      type: 'object',
      properties: {
        horizonDays: { type: 'integer', description: 'Upcoming deadline lookahead in days (default 30).' },
        quarterDays: { type: 'integer', description: 'Bulk filing horizon in days (default 90).' },
        urgentDays: { type: 'integer', description: 'Urgent task threshold in days (default 10).' },
      },
    },
    badge: () => 'Ran autonomous practice automation',
    run: (context, args) => tool_runAutonomousPracticeAutomation(context, args),
  },

  // 12. User & Portal Accounts
  {
    name: TOOL_NAMES.updateUserRole,
    description: 'Change the role of a user in FirmDesk (admin, staff, client). Admin only.',
    parameters: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The 24-character user id.' },
        role: { type: 'string', description: 'One of: admin, staff, client.' },
      },
      required: ['userId', 'role'],
    },
    badge: (result) =>
      isRecord(result) && result.success === true && typeof result.role === 'string'
        ? `Changed user role to ${result.role}`
        : 'Attempted role change',
    run: (context, args) => tool_updateUserRole(context, args),
  },
  {
    name: TOOL_NAMES.linkClientUser,
    description: 'Link client portal user accounts to one or more client records. Admin only.',
    parameters: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The 24-character user id of the client account.' },
        clientIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of 24-character client ids to link.',
        },
      },
      required: ['userId', 'clientIds'],
    },
    badge: (result) =>
      isRecord(result) && result.success === true
        ? 'Linked client portal account'
        : 'Attempted client link',
    run: (context, args) => tool_linkClientUser(context, args),
  },
] as const;

const toolByName = (name: string): ToolSpec | undefined => TOOLS.find((tool) => tool.name === name);

const executeTool = async (
  context: AgentContext,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const tool = toolByName(name);
  if (tool === undefined) return { error: `Unknown tool ${name}.` };
  try {
    return await tool.run(context, args);
  } catch (error) {
    logger.warn({ event: 'ai.tool_failed', tool: name, err: error }, 'AI agent tool failed');
    return { error: 'The tool call failed while running.' };
  }
};

// ---------------------------------------------------------------------------
// Action extraction from "[ACTION] label | route" trailing lines
// ---------------------------------------------------------------------------

const ACTION_LINE = /^\s*\[ACTION\]\s*(.+?)\s*\|\s*(\S+)\s*$/;

const splitActions = (text: string): { content: string; actions: AgentAction[] } => {
  const lines = text.split('\n');
  const actions: AgentAction[] = [];
  let i = lines.length;
  while (i > 0) {
    const line = lines[i - 1] ?? '';
    if (line.trim().length === 0) {
      i -= 1;
      continue;
    }
    const match = ACTION_LINE.exec(line);
    if (match === null) break;
    const route = match[2] ?? '';
    if (isValidActionRoute(route)) {
      actions.unshift({ label: (match[1] ?? '').slice(0, 60), route });
    }
    i -= 1;
  }
  return { content: lines.slice(0, i).join('\n').trim(), actions: actions.slice(0, 3) };
};

// ---------------------------------------------------------------------------
// Provider adapters
// ---------------------------------------------------------------------------

const buildSystemPrompt = (context: AgentContext): string =>
  SYSTEM_PROMPT.replace('{TODAY}', formatDisplayDate(todayIST()))
    .replace('{USER}', context.user.name)
    .replace('{ROLE}', context.user.role)
    .replace('{ROUTE}', context.currentRoute ?? 'unknown');

const ROUTE_CONTEXT_PREFIX = (route: string): string =>
  `[System context] The user is currently viewing this FirmDesk page: ${route}. If it contains a client id, treat "this client" as that client.`;

const historyTurns = (context: AgentContext): Array<{ role: 'user' | 'assistant'; text: string }> =>
  context.history.slice(-MAX_HISTORY_TURNS).map((turn) => ({
    role: turn.role,
    text: turn.content,
  }));

const geminiTools = () => [
  {
    functionDeclarations: TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    })),
  },
];

const runGeminiAgent = async (
  context: AgentContext,
  userMessage: string,
  credentials: { apiKey: string; model: string },
): Promise<{ text: string; badges: AgentToolBadge[] }> => {
  const client = new GoogleGenAI({ apiKey: credentials.apiKey });
  const model = credentials.model;
  const badges: AgentToolBadge[] = [];

  const systemInstruction =
    context.currentRoute !== null
      ? `${buildSystemPrompt(context)}\n\n${ROUTE_CONTEXT_PREFIX(context.currentRoute)}`
      : buildSystemPrompt(context);

  const contents: Array<{ role: 'user' | 'model'; parts: GeminiPart[] }> = [];
  const rawTurns: Array<{ role: 'user' | 'model'; text: string }> = [
    ...historyTurns(context).map((turn) => ({
      role: turn.role === 'user' ? ('user' as const) : ('model' as const),
      text: turn.text,
    })),
    { role: 'user' as const, text: userMessage },
  ];

  for (const turn of rawTurns) {
    if (contents.length === 0) {
      if (turn.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: turn.text }] });
      }
      continue;
    }
    const last = contents[contents.length - 1];
    if (last !== undefined && last.role === turn.role) {
      last.parts.push({ text: turn.text });
    } else {
      contents.push({ role: turn.role, parts: [{ text: turn.text }] });
    }
  }

  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: userMessage }] });
  }

  if (context.image?.dataUrl) {
    const match = context.image.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match && match[1] && match[2]) {
      const lastUserContent = contents.filter((c) => c.role === 'user').pop();
      if (lastUserContent) {
        lastUserContent.parts.unshift({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      }
    }
  }

  for (let iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration += 1) {
    const response = await client.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        tools: geminiTools(),
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const functionCalls = parts.filter(
      (part): part is GeminiPart & { functionCall: GeminiFunctionCall } =>
        part.functionCall !== undefined && part.functionCall !== null,
    );
    const text = parts
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('')
      .trim();

    if (functionCalls.length === 0) {
      return {
        text: text.length > 0 ? text : 'I could not produce an answer. Please rephrase the question.',
        badges,
      };
    }

    const responseParts: GeminiPart[] = [];
    for (const call of functionCalls) {
      const name = call.functionCall.name ?? '';
      const args = call.functionCall.args ?? {};
      const result = await executeTool(context, name, args);
      const tool = toolByName(name);
      if (tool !== undefined) badges.push({ tool: tool.name, label: tool.badge(result) });
      const callId = call.functionCall.id;
      responseParts.push({
        functionResponse: {
          ...(callId ? { id: callId } : {}),
          name,
          response: (result && typeof result === 'object' ? result : { result }) as Record<string, unknown>,
        },
      });
    }
    contents.push({ role: 'model', parts });
    contents.push({ role: 'user', parts: responseParts });
  }

  return { text: 'I stopped after too many tool steps. Try a narrower question.', badges };
};

const openaiTools = (): ChatCompletionTool[] =>
  TOOLS.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));

const runOpenAIAgent = async (
  context: AgentContext,
  userMessage: string,
  credentials: { apiKey: string; model: string; baseURL?: string },
): Promise<{ text: string; badges: AgentToolBadge[] }> => {
  const client = new OpenAI({
    apiKey: credentials.apiKey,
    baseURL: credentials.baseURL,
  });
  const model = credentials.model;
  const badges: AgentToolBadge[] = [];

  const messages: ChatCompletionMessageParam[] = [{ role: 'system', content: buildSystemPrompt(context) }];
  if (context.currentRoute !== null) {
    messages.push({ role: 'system', content: ROUTE_CONTEXT_PREFIX(context.currentRoute) });
  }
  for (const turn of historyTurns(context)) {
    messages.push({ role: turn.role, content: turn.text });
  }
  if (context.image?.dataUrl) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: userMessage },
        { type: 'image_url', image_url: { url: context.image.dataUrl } },
      ],
    });
  } else {
    messages.push({ role: 'user', content: userMessage });
  }

  let supportsTools = true;
  for (let iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration += 1) {
    let completion;
    try {
      completion = await client.chat.completions.create({
        model,
        messages,
        ...(supportsTools ? { tools: openaiTools(), tool_choice: 'auto' } : {}),
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (
        supportsTools &&
        (errMsg.toLowerCase().includes('tool') ||
          errMsg.toLowerCase().includes('function') ||
          errMsg.toLowerCase().includes('not supported') ||
          errMsg.toLowerCase().includes('unrecognized parameter') ||
          errMsg.toLowerCase().includes('unknown parameter'))
      ) {
        logger.info(
          { event: 'ai.tools_unsupported_fallback', model, err: errMsg },
          'Provider does not support tools; retrying completion without tools',
        );
        supportsTools = false;
        completion = await client.chat.completions.create({
          model,
          messages,
        });
      } else {
        throw err;
      }
    }

    const choice = completion.choices[0]?.message;
    if (choice === undefined) {
      return { text: 'I could not produce an answer. Please rephrase the question.', badges };
    }

    const toolCalls = choice.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return {
        text: choice.content?.trim() ?? 'I could not produce an answer. Please rephrase the question.',
        badges,
      };
    }

    messages.push(choice);
    for (const call of toolCalls) {
      if (call.type !== 'function') continue;
      let args: Record<string, unknown> = {};
      if (call.function.arguments.trim().length > 0) {
        try {
          args = JSON.parse(call.function.arguments) as Record<string, unknown>;
        } catch {
          args = {};
        }
      }
      const result = await executeTool(context, call.function.name, args);
      const tool = toolByName(call.function.name);
      if (tool !== undefined) badges.push({ tool: tool.name, label: tool.badge(result) });
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result).slice(0, 20_000),
      });
    }
  }

  return { text: 'I stopped after too many tool steps. Try a narrower question.', badges };
};

// ---------------------------------------------------------------------------
// Static fallback (used when no API key is configured or the provider errors)
// ---------------------------------------------------------------------------

const staticFallbackReply = async (
  context: AgentContext,
  message: string,
  providerFailure?: { provider: AiProviderName; error: unknown } | null,
): Promise<{ content: string; toolCalls: AgentToolBadge[]; actions: AgentAction[] }> => {
  const query = message.toLowerCase();
  const name = context.user.name.split(' ')[0] ?? context.user.name;

  if (context.image?.dataUrl) {
    return {
      content:
        `### 📷 Attached Document / Image Received\n\n` +
        `I received your pasted image. In **reference mode** without an active AI key, computer vision OCR cannot directly inspect raw image pixels.\n\n` +
        `• **With Google Gemini**: Gemini's multimodal vision reads invoices, PAN cards, GST documents, and notices, and can automate client matching and filing actions.\n` +
        `• **To activate**: An admin can configure a Gemini, OpenAI, or Custom provider key under **Settings → AI Copilot**.\n\n` +
        (message ? `*Your query*: "${message}"` : ''),
      toolCalls: [],
      actions: [
        { label: 'AI Settings', route: '/settings' },
        { label: 'Documents', route: '/documents' },
        { label: 'Dashboard', route: '/dashboard' },
      ],
    };
  }

  if (providerFailure) {
    const providerLabel =
      providerFailure.provider === 'gemini'
        ? 'Google Gemini'
        : providerFailure.provider === 'openai'
          ? 'OpenAI'
          : 'Custom Provider (Xkiro / DeepSeek)';
    const errorDetails =
      providerFailure.error instanceof Error ? providerFailure.error.message : '';
    return {
      content:
        `Hello ${name}! I'm temporarily running in **reference mode** because the configured **${providerLabel}** provider call failed${errorDetails ? ` (${errorDetails})` : ''}.\n\n` +
        `I can still read live firm data — try:\n` +
        `• *"What deadlines are coming up?"*\n` +
        `• *"Show pending GST filings"*\n\n` +
        `An admin can verify or change the model and key under Settings → AI Copilot.`,
      toolCalls: [],
      actions: [
        { label: 'AI Settings', route: '/settings' },
        { label: 'Dashboard', route: '/dashboard' },
        { label: 'Statutory Filings', route: '/compliance' },
      ],
    };
  }

  const isPracticeAutomation =
    query.includes('option one') ||
    query.includes('option 1') ||
    query.includes('health check') ||
    query.includes('practice check') ||
    query.includes('total control') ||
    query.includes('run automation') ||
    query.includes('practice automation') ||
    query.includes('automate firm') ||
    query.includes('practice health');

  if (isPracticeAutomation) {
    const result = (await executeTool(context, TOOL_NAMES.runAutonomousPracticeAutomation, {
      horizonDays: 30,
      quarterDays: 90,
      urgentDays: 10,
    })) as {
      deadlines?: { overdueCount: number; upcomingCount: number };
      bulkGeneration?: { created: number; skipped: number; requestsCreated: number };
      tasksCreated?: number;
      practiceSummary?: {
        activeClients: number;
        openDocumentRequests: number;
        overdueFilings: number;
        dueIn7Days: number;
        dueIn30Days: number;
        tasksByStatus: Record<string, number>;
      };
      teamCapacity?: Array<{ staffName: string; openTasks: number; overdueTasks: number; openFilings: number }>;
    };

    const deadlines = result.deadlines ?? { overdueCount: 0, upcomingCount: 0 };
    const bulk = result.bulkGeneration ?? { created: 0, skipped: 0, requestsCreated: 0 };
    const summary = result.practiceSummary ?? {
      activeClients: 0,
      openDocumentRequests: 0,
      overdueFilings: 0,
      dueIn7Days: 0,
      dueIn30Days: 0,
      tasksByStatus: {},
    };
    const team = result.teamCapacity ?? [];

    return {
      content:
        `### 🏥 Comprehensive Practice Automation & Health Check (Option 1 Executed)\n\n` +
        `I have executed the practice automation run across the entire FirmDesk system:\n\n` +
        `1. **Statutory Deadlines & Overdue Filings**:\n` +
        `   • Overdue filings: **${deadlines.overdueCount}**\n` +
        `   • Upcoming filings (next 30 days): **${deadlines.upcomingCount}**\n\n` +
        `2. **Bulk Compliance Filing Generation**:\n` +
        `   • New statutory filings scheduled: **${bulk.created}**\n` +
        `   • Existing filings preserved: **${bulk.skipped}**\n` +
        `   • Automated document requests created: **${bulk.requestsCreated}**\n\n` +
        `3. **Critical Task Scheduling**:\n` +
        `   • New high-priority review tasks scheduled: **${result.tasksCreated ?? 0}** (due this Friday)\n\n` +
        `4. **Practice Snapshot & Capacity**:\n` +
        `   • Active clients: **${summary.activeClients}**\n` +
        `   • Open document requests pending client upload: **${summary.openDocumentRequests}**\n` +
        `   • Team members on duty: **${team.map((t) => `${t.staffName} (${t.openTasks} tasks)`).join(', ') || 'None'}**\n\n` +
        `*Total operational control is active across 37 practice tools. I can attach client services, chase document requests, or modify any records directly.*`,
      toolCalls: [
        {
          tool: TOOL_NAMES.runAutonomousPracticeAutomation,
          label: 'Executed autonomous practice automation',
        },
      ],
      actions: [
        { label: 'View Tasks', route: '/tasks' },
        { label: 'Statutory Filings', route: '/compliance' },
        { label: 'Document Requests', route: '/requests' },
      ],
    };
  }

  const isTaskCreation =
    query.includes('add a task') ||
    query.includes('add task') ||
    query.includes('create a task') ||
    query.includes('create task') ||
    query.includes('new task') ||
    query.includes('assign a task') ||
    query.includes('assign task');

  if (isTaskCreation) {
    return {
      content:
        `### 📝 Task creation in reference mode\n\n` +
        `Automated task creation directly from chat requires an active AI provider key (Google Gemini or OpenAI).\n\n` +
        `To create tasks right now:\n` +
        `• Open the **Tasks** page to add and assign this task manually.\n` +
        `• An admin can configure a Gemini or OpenAI key under **Settings → AI Copilot** to enable instant chat task creation and full workflow automation.`,
      toolCalls: [],
      actions: [
        { label: 'Open Tasks', route: '/tasks' },
        { label: 'My Work Queue', route: '/my-work' },
        { label: 'AI Settings', route: '/settings' },
      ],
    };
  }

  if (query.includes('deadline') || query.includes('due date') || query.includes('upcoming')) {
    const result = (await executeTool(context, TOOL_NAMES.upcomingDeadlines, { horizonDays: 14 })) as {
      overdueCount?: number;
      upcoming?: Array<{ clientName: string; filingName: string; dueDate: string | null; status: string }>;
    };
    const upcoming = result.upcoming ?? [];
    const lines = upcoming
      .slice(0, 10)
      .map(
        (item) =>
          `• **${item.filingName}** — ${item.clientName}, due **${item.dueDate ?? 'soon'}** (${item.status.replace(/_/g, ' ')})`,
      );
    return {
      content:
        `### 📅 Statutory deadlines in the next 14 days\n\n` +
        (upcoming.length === 0
          ? `Nothing is due in the next 14 days for clients you can access.\n\n`
          : `${lines.join('\n')}\n\n`) +
        (typeof result.overdueCount === 'number' && result.overdueCount > 0
          ? `⚠️ You also have **${result.overdueCount} overdue filing${result.overdueCount === 1 ? '' : 's'}**.\n\n`
          : '') +
        `*This reply came from FirmDesk's built-in reference mode. An admin can add a Gemini or OpenAI key under Settings → AI Copilot for full conversational operations.*`,
      toolCalls: [
        {
          tool: TOOL_NAMES.upcomingDeadlines,
          label: `Checked ${upcoming.length} upcoming deadline${upcoming.length === 1 ? '' : 's'}`,
        },
      ],
      actions: [
        { label: 'View Statutory Filings', route: '/compliance' },
        { label: 'My Work Queue', route: '/my-work' },
      ],
    };
  }

  if (query.includes('gst') || query.includes('tds') || query.includes('itr') || query.includes('filing')) {
    const category = query.includes('tds')
      ? 'tds'
      : query.includes('itr') || query.includes('income tax')
        ? 'income_tax'
        : 'gst';
    const result = (await executeTool(context, TOOL_NAMES.complianceFilings, {
      category,
      status: 'pending',
      limit: 10,
    })) as {
      filings?: Array<{ clientName: string; filingName: string; periodLabel: string; dueDate: string | null }>;
    };
    const filings = result.filings ?? [];
    const lines = filings.map(
      (item) => `• ${item.clientName} — **${item.filingName}** (${item.periodLabel}), due **${item.dueDate ?? '—'}**`,
    );
    return {
      content:
        `### 📋 Pending ${category.replace(/_/g, ' ').toUpperCase()} filings\n\n` +
        (filings.length === 0
          ? `No pending ${category.toUpperCase()} filings found in your scope.\n\n`
          : `${lines.join('\n')}\n\n`) +
        `*This reply came from FirmDesk's built-in reference mode. An admin can add a Gemini or OpenAI key under Settings → AI Copilot for full conversational operations.*`,
      toolCalls: [
        { tool: TOOL_NAMES.complianceFilings, label: `Checked ${filings.length} filing${filings.length === 1 ? '' : 's'}` },
      ],
      actions: [
        { label: 'Open Filings', route: '/compliance' },
        { label: 'Bulk Generate Filings', route: '/compliance/generate' },
      ],
    };
  }

  if (query.includes('task') || query.includes('work')) {
    const summary = (await executeTool(context, TOOL_NAMES.firmSummary, {})) as {
      tasksByStatus?: Record<string, number>;
    };
    const tasks = summary.tasksByStatus ?? {};
    return {
      content:
        `### ✅ Your task board snapshot\n\n` +
        `• Not started: **${tasks.not_started ?? 0}**\n` +
        `• In progress: **${tasks.in_progress ?? 0}**\n` +
        `• In review: **${tasks.review ?? 0}**\n` +
        `• Done: **${tasks.done ?? 0}**\n\n` +
        `Once an AI provider key is configured, I can fully automate task creation, status updates, reassignments, comments, and deletions directly from chat!`,
      toolCalls: [{ tool: TOOL_NAMES.firmSummary, label: 'Pulled task summary' }],
      actions: [
        { label: 'Open Tasks', route: '/tasks' },
        { label: 'My Work Queue', route: '/my-work' },
      ],
    };
  }

  if (query.includes('automate') || query.includes('can you do') || query.includes('capabilities') || query.includes('help')) {
    return {
      content:
        `### 🤖 FirmDesk AI Copilot Full Website Automation Capabilities\n\n` +
        `I am designed to automate practice operations across the whole FirmDesk application:\n\n` +
        `• **Client Management**: Create new clients, update client PAN/GSTIN/contacts, inspect profiles, and archive/restore records.\n` +
        `• **Task Automation**: Create tasks, search tasks, update task status (not started, in progress, review, done), reassign, add comments, and delete.\n` +
        `• **Statutory Compliance**: Track filings (GST, TDS, ITR, MCA), mark filings as filed with ARN/challan numbers, update due dates, and bulk-generate returns.\n` +
        `• **Document Requests**: Raise document requests, cancel unneeded requests, send email reminders, and inspect client uploaded files.\n` +
        `• **Client Communications**: Post notices and messages directly into client portal threads.\n` +
        `• **Team Operations**: Look up staff/admin team members and automate workload assignments.\n` +
        `• **Firm Settings**: View and update firm profile, address, contact details, and compliance horizon.\n` +
        `• **Analytics & Reports**: Run compliance scorecards, team workload distributions, and client roster reports.\n\n` +
        `*To activate live autonomous tool execution, an admin can configure a Google Gemini or OpenAI API key under Settings → AI Copilot.*`,
      toolCalls: [],
      actions: [
        { label: 'AI Settings', route: '/settings' },
        { label: 'Dashboard', route: '/dashboard' },
        { label: 'Statutory Filings', route: '/compliance' },
      ],
    };
  }

  return {
    content:
      `Hello ${name}! I'm running in **reference mode** because no AI provider key is configured yet.\n\n` +
      `I can still read live firm data — try:\n` +
      `• *"What deadlines are coming up?"*\n` +
      `• *"Show pending GST filings"*\n` +
      `• *"How many tasks do I have?"*\n` +
      `• *"What can you automate?"*\n\n` +
      `To unlock full conversational powers and automate the whole website (creating/updating clients, filings, tasks, messages, and settings), an admin can add a **Gemini** or **OpenAI API key** under Settings → AI Copilot.`,
    toolCalls: [],
    actions: [
      { label: 'Dashboard', route: '/dashboard' },
      { label: 'Statutory Filings', route: '/compliance' },
      { label: 'AI Settings', route: '/settings' },
    ],
  };
};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

const sanitiseHistory = (raw: unknown): AgentChatTurn[] => {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((turn): AgentChatTurn[] => {
    if (!isRecord(turn)) return [];
    const role = turn.role === 'user' || turn.role === 'assistant' ? turn.role : null;
    const content = typeof turn.content === 'string' ? turn.content.slice(0, 4000) : null;
    if (role === null || content === null || content.trim().length === 0) return [];
    return [{ role, content }];
  });
};

export const runAiAgent = async (input: {
  user: AuthenticatedUser;
  actor: RequestActor;
  message: string;
  history: unknown;
  currentRoute: string | null;
  image?: { dataUrl: string; mimeType?: string } | null;
}): Promise<AgentReply> => {
  const trimmed = input.message.trim().slice(0, 4000);
  const message =
    trimmed.length > 0
      ? trimmed
      : input.image
        ? 'Please analyze this attached document or image and identify the client, filing details, amounts, tax identifiers, or relevant action items.'
        : '';
  if (message.length === 0 && !input.image) {
    throw forbidden('Ask a question to get started.');
  }
  const context: AgentContext = {
    user: input.user,
    actor: input.actor,
    history: sanitiseHistory(input.history),
    currentRoute: typeof input.currentRoute === 'string' ? input.currentRoute.slice(0, 200) : null,
    image: input.image ?? null,
  };

  let providerFailure: { provider: AiProviderName; error: unknown } | null = null;
  const resolved = await resolveAiProvider();
  if (resolved !== null) {
    try {
      const { text, badges } =
        resolved.provider === 'gemini'
          ? await runGeminiAgent(context, message, {
              apiKey: resolved.apiKey,
              model: resolved.model,
            })
          : await runOpenAIAgent(context, message, {
              apiKey: resolved.apiKey,
              model: resolved.model,
              baseURL: resolved.baseURL,
            });
      const { content, actions } = splitActions(text);
      return { content, toolCalls: badges, actions, mode: 'llm' };
    } catch (error) {
      providerFailure = { provider: resolved.provider, error };
      logger.warn(
        { event: 'ai.provider_failed', provider: resolved.provider, err: error },
        'LLM provider call failed, falling back to reference mode',
      );
    }
  }

  const fallback = await staticFallbackReply(context, message, providerFailure);
  return { ...fallback, mode: 'fallback' };
};
