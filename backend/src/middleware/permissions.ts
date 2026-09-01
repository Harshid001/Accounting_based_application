import type { Role } from '../lib/enums.js';

export const CAPABILITIES = {
  'profile:manage': ['admin', 'staff', 'client'],

  'client:read': ['admin', 'staff'],
  'client:create': ['admin'],
  'client:update': ['admin', 'staff'],
  'client:update_privileged': ['admin'],
  'client:archive': ['admin'],
  'client:assign_staff': ['admin'],
  'client:reveal_aadhaar': ['admin'],
  'client:export': ['admin', 'staff'],
  'client:pin': ['admin', 'staff'],

  'catalogue:read': ['admin', 'staff'],
  'catalogue:write': ['admin'],

  'client_service:read': ['admin', 'staff'],
  'client_service:write': ['admin', 'staff'],
  'client_service:delete': ['admin'],

  'compliance:read': ['admin', 'staff'],
  'compliance:create': ['admin', 'staff'],
  'compliance:update': ['admin', 'staff'],
  'compliance:status': ['admin', 'staff'],
  'compliance:bulk': ['admin'],
  'compliance:delete': ['admin'],
  'compliance:export': ['admin', 'staff'],

  'task:read': ['admin', 'staff'],
  'task:create': ['admin', 'staff'],
  'task:update': ['admin', 'staff'],
  'task:assign': ['admin', 'staff'],
  'task:delete': ['admin'],
  'task_comment:read': ['admin', 'staff'],
  'task_comment:write': ['admin', 'staff'],
  'my_work:read': ['admin', 'staff'],

  'document:read': ['admin', 'staff', 'client'],
  'document:write': ['admin', 'staff', 'client'],
  'document:version': ['admin', 'staff'],
  'document:update': ['admin', 'staff'],
  'document:archive': ['admin', 'staff', 'client'],
  'document:hard_delete': ['admin'],
  'document:presign': ['admin', 'staff', 'client'],

  'document_request:read': ['admin', 'staff'],
  'document_request:write': ['admin', 'staff'],
  'document_request:remind': ['admin', 'staff'],

  'message:read': ['admin', 'staff', 'client'],
  'message:write': ['admin', 'staff', 'client'],
  'message:threads': ['admin', 'staff'],

  'notification:read': ['admin', 'staff', 'client'],
  'notification:write': ['admin', 'staff', 'client'],

  'user:manage': ['admin'],
  'audit:read': ['admin'],
  'job:manage': ['admin'],

  'report:read': ['admin', 'staff'],
  'report:export': ['admin', 'staff'],

  'settings:read': ['admin', 'staff', 'client'],
  'settings:write': ['admin'],

  'search:run': ['admin', 'staff'],

  'portal:read': ['client'],
  'portal:write': ['client'],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof CAPABILITIES;

const table: Record<string, readonly Role[]> = CAPABILITIES;

export const isKnownCapability = (value: string): value is Capability =>
  Object.hasOwn(table, value);

export const roleHasCapability = (role: Role, capability: string): boolean => {
  const allowed = table[capability];
  if (allowed === undefined) return false;
  return allowed.includes(role);
};

export const capabilitiesFor = (role: Role): Capability[] =>
  (Object.keys(table) as Capability[]).filter((capability) =>
    roleHasCapability(role, capability),
  );

export const renderPermissions = (role: Role): Record<Capability, boolean> => {
  const out = {} as Record<Capability, boolean>;
  for (const capability of Object.keys(table) as Capability[]) {
    out[capability] = roleHasCapability(role, capability);
  }
  return out;
};
