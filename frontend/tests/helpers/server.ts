import { vi } from 'vitest';

import type { Me } from '@/types/models';
import { CAPABILITY_KEYS } from '@/lib/permissions';
import type { Capability } from '@/lib/permissions';
import type { Role } from '@/types/enums';

const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  admin: CAPABILITY_KEYS.filter((key) => !key.startsWith('portal:')),
  staff: CAPABILITY_KEYS.filter(
    (key) =>
      !key.startsWith('portal:') &&
      ![
        'client:create',
        'client:update_privileged',
        'client:archive',
        'client:assign_staff',
        'client:reveal_aadhaar',
        'catalogue:write',
        'client_service:delete',
        'compliance:bulk',
        'compliance:delete',
        'task:delete',
        'document:hard_delete',
        'user:manage',
        'audit:read',
        'job:manage',
        'settings:write',
      ].includes(key),
  ),
  client: [
    'profile:manage',
    'document:read',
    'document:write',
    'document:archive',
    'document:presign',
    'message:read',
    'message:write',
    'notification:read',
    'notification:write',
    'settings:read',
    'portal:read',
    'portal:write',
  ],
};

export const permissionsFor = (role: Role): Partial<Record<Capability, boolean>> => {
  const out: Partial<Record<Capability, boolean>> = {};
  for (const key of CAPABILITY_KEYS) out[key] = ROLE_CAPABILITIES[role].includes(key);
  return out;
};

export const makeMe = (overrides: Partial<Me> = {}): Me => {
  const role = overrides.role ?? 'admin';
  return {
    id: 'user-1',
    name: 'Priya Nair',
    email: 'priya@firm.example',
    emailVerified: true,
    role,
    status: 'active',
    phone: null,
    image: null,
    linkedClients: [],
    pinnedClients: [],
    notificationPreferences: {
      emailOnAssignment: true,
      emailDeadlineReminders: true,
      emailDailyDigest: false,
    },
    unlinked: role === 'client' && (overrides.linkedClients ?? []).length === 0,
    permissions: permissionsFor(role),
    ...overrides,
  };
};

export interface StubRoute {
  match: string;
  status?: number;
  data?: unknown;
  meta?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
}

export interface FetchStub {
  calls: string[];
  restore: () => void;
}

const listMeta = (items: unknown): Record<string, unknown> =>
  Array.isArray(items)
    ? { total: items.length, page: 1, limit: 25, totalPages: 1 }
    : {};

export const stubFetch = (routes: readonly StubRoute[]): FetchStub => {
  const calls: string[] = [];

  const reply = (body: unknown, status: number): Promise<Response> =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'req-test' },
      }),
    );

  const handler = vi.fn((input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);

    const route = routes.find((candidate) => url.includes(candidate.match));

    if (route === undefined) {
      return reply(
        { error: { code: 'NOT_FOUND', message: 'No stub for this route.', requestId: 'req-test' } },
        404,
      );
    }

    if (route.errorCode !== undefined) {
      return reply(
        {
          error: {
            code: route.errorCode,
            message: route.errorMessage ?? 'Stubbed failure.',
            requestId: 'req-test',
          },
        },
        route.status ?? 400,
      );
    }

    return reply(
      {
        data: route.data ?? null,
        meta: { requestId: 'req-test', ...listMeta(route.data), ...route.meta },
      },
      route.status ?? 200,
    );
  });

  vi.stubGlobal('fetch', handler);

  return {
    calls,
    restore: () => {
      vi.unstubAllGlobals();
    },
  };
};
