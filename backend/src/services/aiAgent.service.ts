import { GoogleGenAI } from '@google/genai';
import type { FunctionCall as GeminiFunctionCall, Part as GeminiPart } from '@google/genai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import OpenAI from 'openai';

import { logger } from '../config/logger.js';
import { addDays, formatDisplayDate, todayIST } from '../lib/date.js';
import {
  CLOSED_COMPLIANCE_STATUSES,
  COMPLIANCE_CATEGORIES,
  COMPLIANCE_STATUSES,
  DOCUMENT_TYPES,
} from '../lib/enums.js';
import type {
  ComplianceCategory,
  ComplianceStatus,
  DocumentType,
  TaskPriority,
} from '../lib/enums.js';
import { forbidden } from '../lib/errors.js';
import { toPageRequest } from '../lib/pagination.js';
import { ComplianceItem } from '../models/complianceItem.model.js';
import { ComplianceType } from '../models/complianceType.model.js';
import type { AuthenticatedUser, RequestActor } from '../types/context.js';
import { dashboardSummary } from './report.service.js';
import { createDocumentRequests } from './documentRequest.service.js';
import { accessibleClientIds } from './compliance.service.js';
import { listClients } from './client.service.js';
import { createTask } from './task.service.js';
import { resolveAiProvider } from './settings.service.js';

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
}

const MAX_AGENT_ITERATIONS = 6;
const MAX_HISTORY_TURNS = 20;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const TOOL_NAMES = {
  searchClients: 'search_clients',
  complianceFilings: 'get_compliance_filings',
  upcomingDeadlines: 'get_upcoming_deadlines',
  createTask: 'create_task',
  createDocumentRequest: 'create_document_request',
  firmSummary: 'get_firm_summary',
} as const;

type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

const SYSTEM_PROMPT = `You are FirmDesk Copilot, the AI assistant inside FirmDesk, a practice management platform for a single Indian accounting (CA) firm. Today is {TODAY} (IST) and the user is {USER}, a firm {ROLE} user, currently viewing the page {ROUTE}.

You help with Indian taxation and statutory compliance (GST, TDS, Income Tax, ROC/MCA), practice workflow, and FirmDesk navigation.

## Capabilities
- Answer Indian tax and compliance questions accurately, citing sections, due dates and thresholds where relevant.
- Call tools to read LIVE firm data: clients, statutory filings, deadlines, tasks, and firm summary. Never invent firm data - use a tool whenever the question touches the firm's own records.
- Create tasks and raise document requests when explicitly asked, then confirm exactly what was created.
- Draft client communications (emails, reminders) in professional Indian English.

## Tool rules
- The current page route may contain a client id (for example /clients/<id>/profile). When the user says "this client" or "my filings", prefer that client and pass its id as clientId.
- Date parameters must be YYYY-MM-DD.
- If a tool returns an error, state it plainly and answer what you can.

## Style
- Be concise and practical, like a senior CA advising a colleague: direct answer first, then detail.
- Use markdown: short paragraphs, **bold** for key dates and figures, bullet lists, and simple tables when comparing items.
- At the very end you may suggest up to 3 follow-up navigation actions, one per line, in exactly this format and nothing after them:
  [ACTION] label | route
  Allowed routes: /dashboard /clients /tasks /my-work /compliance /compliance/generate /requests /messages /reports /settings`;

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

const namedOf = (value: unknown, key: string): string | null => {
  if (value === null || typeof value !== 'object') return null;
  const found = (value as Record<string, unknown>)[key];
  return typeof found === 'string' ? found : null;
};

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;
// ---------------------------------------------------------------------------
// Tool implementations — every query is scoped through the AuthenticatedUser
// ---------------------------------------------------------------------------

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

  try {
    const created = await createTask(
      {
        title: title.slice(0, 200),
        description: typeof args.description === 'string' ? args.description.slice(0, 8000) : null,
        clientId: requestedClient,
        assigneeId: user.id.toString(),
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
  const clientId = typeof args.clientId === 'string' && OBJECT_ID_PATTERN.test(args.clientId) ? args.clientId : null;
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
      new (await import('mongoose')).Types.ObjectId(clientId),
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

const tool_getFirmSummary = async (user: AuthenticatedUser): Promise<unknown> => {
  const summary = await dashboardSummary(user);
  return { ...summary, today: formatDisplayDate(todayIST()) };
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

const withRouteContext = (
  context: AgentContext,
  name: ToolName,
  args: Record<string, unknown>,
): Record<string, unknown> => {
  if (context.currentRoute === null) return args;
  const match = CLIENT_OF_ROUTE.exec(context.currentRoute);
  const routeClient = match === null ? null : (match[1] ?? null);
  if (routeClient === null) return args;
  if (name === TOOL_NAMES.complianceFilings && args.clientId === undefined) {
    return { ...args, clientId: routeClient };
  }
  if (
    (name === TOOL_NAMES.createTask || name === TOOL_NAMES.createDocumentRequest) &&
    args.clientId === undefined &&
    context.user.role !== 'client'
  ) {
    return { ...args, clientId: routeClient };
  }
  return args;
};

const TOOLS: readonly ToolSpec[] = [
  {
    name: TOOL_NAMES.searchClients,
    description:
      "Search the firm's client directory by name, PAN or GSTIN. Returns matching clients with their ids.",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search text: client name, PAN or GSTIN fragment.' },
        status: {
          type: 'string',
          description: 'Optional filter: onboarding, active or inactive.',
        },
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
    name: TOOL_NAMES.createTask,
    description:
      'Create a work task in FirmDesk. Firm users only (admin/staff). The task is assigned to the requesting user.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short task title, 3 to 200 characters.' },
        priority: { type: 'string', description: 'One of: low, normal, high, urgent.' },
        dueDate: { type: 'string', description: 'Due date as YYYY-MM-DD.' },
        clientId: { type: 'string', description: 'Optional 24-character client id to link the task.' },
        description: { type: 'string', description: 'Optional longer description.' },
      },
      required: ['title'],
    },
    badge: (result) =>
      isRecord(result) && result.created === true ? 'Created task' : 'Attempted task creation',
    run: (context, args) => tool_createTask(context, withRouteContext(context, TOOL_NAMES.createTask, args)),
  },
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
          description: 'Documents to request. Each entry: { "title": string, optional "documentType": one of purchase_invoice, sales_invoice, bank_statement, tax_document, income_proof, expense_document, audit_document, other }.',
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
    name: TOOL_NAMES.firmSummary,
    description:
      'Firm dashboard summary: client count, tasks by status, filings due in 7/14/30 days, overdue filings, awaiting-client count, open document requests and team workload.',
    parameters: { type: 'object', properties: {} },
    badge: () => 'Pulled firm summary',
    run: (context) => tool_getFirmSummary(context.user),
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
    if (VALID_ACTION_ROUTES.has(route)) {
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
      parametersJsonSchema: tool.parameters,
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

  const contents: Array<{ role: 'user' | 'model'; parts: GeminiPart[] }> = [];
  if (context.currentRoute !== null) {
    contents.push({ role: 'user', parts: [{ text: ROUTE_CONTEXT_PREFIX(context.currentRoute) }] });
  }
  for (const turn of historyTurns(context)) {
    contents.push({
      role: turn.role === 'user' ? 'user' : 'model',
      parts: [{ text: turn.text }],
    });
  }
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  for (let iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration += 1) {
    const response = await client.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: buildSystemPrompt(context),
        tools: geminiTools(),
      },
    });

    const parts = (response.candidates?.[0]?.content?.parts ?? []);
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
      const args = (call.functionCall.args ?? {});
      const result = await executeTool(context, name, args);
      const tool = toolByName(name);
      if (tool !== undefined) badges.push({ tool: tool.name, label: tool.badge(result) });
      responseParts.push({
        functionResponse: { name, response: result as Record<string, unknown> },
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
  credentials: { apiKey: string; model: string },
): Promise<{ text: string; badges: AgentToolBadge[] }> => {
  const client = new OpenAI({ apiKey: credentials.apiKey });
  const model = credentials.model;
  const badges: AgentToolBadge[] = [];

  const messages: ChatCompletionMessageParam[] = [{ role: 'system', content: buildSystemPrompt(context) }];
  if (context.currentRoute !== null) {
    messages.push({ role: 'system', content: ROUTE_CONTEXT_PREFIX(context.currentRoute) });
  }
  for (const turn of historyTurns(context)) {
    messages.push({ role: turn.role, content: turn.text });
  }
  messages.push({ role: 'user', content: userMessage });

  for (let iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration += 1) {
    const completion = await client.chat.completions.create({
      model,
      messages,
      tools: openaiTools(),
      tool_choice: 'auto',
    });

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
): Promise<{ content: string; toolCalls: AgentToolBadge[]; actions: AgentAction[] }> => {
  const query = message.toLowerCase();
  const name = context.user.name.split(' ')[0] ?? context.user.name;

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
        `*This reply came from FirmDesk's built-in reference mode. An admin can add a Gemini or OpenAI key under Settings ? AI Copilot for full conversational answers.*`,
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
        `*This reply came from FirmDesk's built-in reference mode. An admin can add a Gemini or OpenAI key under Settings ? AI Copilot for full conversational answers.*`,
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
        `Once an AI provider key is configured, I can also create tasks on request — for example *"Create a high priority task: verify the TDS challan for a client by Friday"*.`,
      toolCalls: [{ tool: TOOL_NAMES.firmSummary, label: 'Pulled task summary' }],
      actions: [
        { label: 'Open Tasks', route: '/tasks' },
        { label: 'My Work Queue', route: '/my-work' },
      ],
    };
  }

  return {
    content:
      `Hello ${name}! I'm running in **reference mode** because no AI provider key is configured yet.\n\n` +
      `I can still read live data — try:\n` +
      `• *"What deadlines are coming up?"*\n` +
      `• *"Show pending GST filings"*\n\n` +
      `To unlock full conversational answers and tool-driven task creation, an admin can add a **Gemini** or **OpenAI API key** under Settings → AI Copilot.`,
    toolCalls: [],
    actions: [
      { label: 'Dashboard', route: '/dashboard' },
      { label: 'Statutory Filings', route: '/compliance' },
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
}): Promise<AgentReply> => {
  const message = input.message.trim().slice(0, 4000);
  if (message.length === 0) {
    throw forbidden('Ask a question to get started.');
  }
  const context: AgentContext = {
    user: input.user,
    actor: input.actor,
    history: sanitiseHistory(input.history),
    currentRoute: typeof input.currentRoute === 'string' ? input.currentRoute.slice(0, 200) : null,
  };

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
            });
      const { content, actions } = splitActions(text);
      return { content, toolCalls: badges, actions, mode: 'llm' };
    } catch (error) {
      logger.warn(
        { event: 'ai.provider_failed', provider: resolved.provider, err: error },
        'LLM provider call failed, falling back to reference mode',
      );
    }
  }

  const fallback = await staticFallbackReply(context, message);
  return { ...fallback, mode: 'fallback' };
};
