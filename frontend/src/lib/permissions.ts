import type { Role } from '@/types/enums';

export const CAPABILITY_KEYS = [
  'profile:manage',
  'client:read',
  'client:create',
  'client:update',
  'client:update_privileged',
  'client:archive',
  'client:assign_staff',
  'client:reveal_aadhaar',
  'client:export',
  'client:pin',
  'catalogue:read',
  'catalogue:write',
  'client_service:read',
  'client_service:write',
  'client_service:delete',
  'compliance:read',
  'compliance:create',
  'compliance:update',
  'compliance:status',
  'compliance:bulk',
  'compliance:delete',
  'compliance:export',
  'task:read',
  'task:create',
  'task:update',
  'task:assign',
  'task:delete',
  'task_comment:read',
  'task_comment:write',
  'my_work:read',
  'document:read',
  'document:write',
  'document:version',
  'document:update',
  'document:archive',
  'document:hard_delete',
  'document:presign',
  'document_request:read',
  'document_request:write',
  'document_request:remind',
  'message:read',
  'message:write',
  'message:threads',
  'notification:read',
  'notification:write',
  'user:manage',
  'audit:read',
  'job:manage',
  'report:read',
  'report:export',
  'settings:read',
  'settings:write',
  'search:run',
  'portal:read',
  'portal:write',
] as const;

export type Capability = (typeof CAPABILITY_KEYS)[number];

export type PermissionMap = Partial<Record<Capability, boolean>>;

export interface PermissionSubject {
  role: Role;
  permissions: PermissionMap;
}

export const can = (
  subject: PermissionSubject | null | undefined,
  capability: Capability,
): boolean => {
  if (!subject) return false;
  return subject.permissions[capability] === true;
};

export const canAny = (
  subject: PermissionSubject | null | undefined,
  capabilities: readonly Capability[],
): boolean => capabilities.some((capability) => can(subject, capability));

export const canAll = (
  subject: PermissionSubject | null | undefined,
  capabilities: readonly Capability[],
): boolean => capabilities.every((capability) => can(subject, capability));

export const isAdmin = (subject: PermissionSubject | null | undefined): boolean =>
  subject?.role === 'admin';

export const isStaffSide = (subject: PermissionSubject | null | undefined): boolean =>
  subject?.role === 'admin' || subject?.role === 'staff';

export const isClient = (subject: PermissionSubject | null | undefined): boolean =>
  subject?.role === 'client';

export const homePathFor = (role: Role | null | undefined): string => {
  switch (role) {
    case 'admin':
    case 'staff':
      return '/dashboard';
    case 'client':
      return '/portal';
    default:
      return '/sign-in';
  }
};

export const isKnownCapability = (value: string): value is Capability =>
  (CAPABILITY_KEYS as readonly string[]).includes(value);
