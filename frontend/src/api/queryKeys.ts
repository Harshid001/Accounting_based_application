import type { QueryParams } from '@/types/api';

const scoped = (params: QueryParams | undefined): QueryParams => params ?? {};

export const queryKeys = {
  me: ['me'] as const,
  mySessions: ['me', 'sessions'] as const,

  clients: {
    all: ['clients'] as const,
    list: (params?: QueryParams) => ['clients', 'list', scoped(params)] as const,
    detail: (id: string) => ['clients', 'detail', id] as const,
    activity: (id: string, params?: QueryParams) =>
      ['clients', 'activity', id, scoped(params)] as const,
    services: (id: string) => ['clients', 'services', id] as const,
    messages: (id: string, params?: QueryParams) =>
      ['clients', 'messages', id, scoped(params)] as const,
  },

  complianceTypes: {
    all: ['compliance-types'] as const,
    list: (params?: QueryParams) => ['compliance-types', 'list', scoped(params)] as const,
    detail: (id: string) => ['compliance-types', 'detail', id] as const,
  },

  compliance: {
    all: ['compliance'] as const,
    list: (params?: QueryParams) => ['compliance', 'list', scoped(params)] as const,
    detail: (id: string) => ['compliance', 'detail', id] as const,
  },

  filingPreparations: {
    all: ['filing-preparations'] as const,
    detail: (id: string) => ['filing-preparations', 'detail', id] as const,
  },

  tasks: {
    all: ['tasks'] as const,
    list: (params?: QueryParams) => ['tasks', 'list', scoped(params)] as const,
    detail: (id: string) => ['tasks', 'detail', id] as const,
    comments: (id: string, params?: QueryParams) =>
      ['tasks', 'comments', id, scoped(params)] as const,
  },

  myWork: (params?: QueryParams) => ['my-work', scoped(params)] as const,

  documents: {
    all: ['documents'] as const,
    list: (params?: QueryParams) => ['documents', 'list', scoped(params)] as const,
    detail: (id: string) => ['documents', 'detail', id] as const,
  },

  documentRequests: {
    all: ['document-requests'] as const,
    list: (params?: QueryParams) => ['document-requests', 'list', scoped(params)] as const,
  },

  messages: {
    all: ['messages'] as const,
    threads: ['messages', 'threads'] as const,
  },

  notifications: {
    all: ['notifications'] as const,
    list: (params?: QueryParams) => ['notifications', 'list', scoped(params)] as const,
    unread: ['notifications', 'unread-count'] as const,
  },

  users: {
    all: ['users'] as const,
    list: (params?: QueryParams) => ['users', 'list', scoped(params)] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
    staff: ['users', 'staff'] as const,
  },

  reports: {
    all: ['reports'] as const,
    dashboard: ['reports', 'dashboard'] as const,
    compliance: (params?: QueryParams) => ['reports', 'compliance', scoped(params)] as const,
    workload: (params?: QueryParams) => ['reports', 'workload', scoped(params)] as const,
    roster: (params?: QueryParams) => ['reports', 'roster', scoped(params)] as const,
  },

  portal: {
    all: ['portal'] as const,
    clients: ['portal', 'clients'] as const,
    overview: (clientId: string) => ['portal', 'overview', clientId] as const,
    compliance: (clientId: string, params?: QueryParams) =>
      ['portal', 'compliance', clientId, scoped(params)] as const,
    tasks: (clientId: string, params?: QueryParams) =>
      ['portal', 'tasks', clientId, scoped(params)] as const,
    requests: (clientId: string, params?: QueryParams) =>
      ['portal', 'requests', clientId, scoped(params)] as const,
    profile: (clientId: string) => ['portal', 'profile', clientId] as const,
    activity: (clientId: string, params?: QueryParams) =>
      ['portal', 'activity', clientId, scoped(params)] as const,
  },

  search: (term: string) => ['search', term] as const,

  settings: {
    all: ['settings'] as const,
    firm: ['settings', 'firm'] as const,
    aiConfig: ['settings', 'ai-config'] as const,
  },

  audit: {
    all: ['audit'] as const,
    list: (params?: QueryParams) => ['audit', 'list', scoped(params)] as const,
  },

  jobs: {
    all: ['jobs'] as const,
    list: (params?: QueryParams) => ['jobs', 'list', scoped(params)] as const,
  },

  desktop: {
    workstations: (params?: QueryParams) => ['desktop', 'workstations', scoped(params)] as const,
    manifest: ['desktop', 'manifest'] as const,
  },

  automation: {
    all: ['automation'] as const,
    detail: (id: string) => ['automation', 'detail', id] as const,
    list: (filters?: { clientId?: string; status?: string; limit?: number }) =>
      ['automation', 'list', filters ?? {}] as const,
    support: ['automation', 'support'] as const,
  },

  books: {
    all: ['books'] as const,
    status: (clientId: string) => ['books', 'status', clientId] as const,
    accounts: {
      list: (params?: QueryParams) => ['books', 'accounts', 'list', scoped(params)] as const,
      detail: (id: string) => ['books', 'accounts', 'detail', id] as const,
    },
    vouchers: {
      list: (params?: QueryParams) => ['books', 'vouchers', 'list', scoped(params)] as const,
      detail: (id: string) => ['books', 'vouchers', 'detail', id] as const,
    },
    dayBook: (params?: QueryParams) => ['books', 'day-book', scoped(params)] as const,
    ledger: (params?: QueryParams) => ['books', 'ledger', scoped(params)] as const,
    trialBalance: (params?: QueryParams) => ['books', 'trial-balance', scoped(params)] as const,
    periods: (clientId: string) => ['books', 'periods', clientId] as const,
    tally: (clientId: string) => ['books', 'tally', clientId] as const,
  },
} as const;

export const invalidateOnClientChange = [
  queryKeys.clients.all,
  queryKeys.reports.all,
  queryKeys.portal.all,
] as const;
