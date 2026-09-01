import type { Capability } from '../middleware/permissions.js';
import { renderPermissions } from '../middleware/permissions.js';
import type { UserAttributes } from '../models/user.model.js';
import type { SessionSummary } from '../services/user.service.js';
import type { AuthenticatedUser } from '../types/context.js';
import type { Lean } from '../types/lean.js';
import { namedRef, timestamp } from './common.js';
import type { NamedRef } from './common.js';

type UserRecord = Lean<UserAttributes>;

export interface AdminUserView {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string;
  status: string;
  phone: string | null;
  image: string | null;
  linkedClients: NamedRef[];
  notificationPreferences: UserAttributes['notificationPreferences'];
  lastSeenAt: string | null;
  createdAt: string | null;
}

export const serialiseUserForAdmin = (user: UserRecord): AdminUserView => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified,
  role: user.role,
  status: user.status,
  phone: user.phone ?? null,
  image: user.image ?? null,
  linkedClients: (user.linkedClients as unknown[])
    .map((value) => namedRef(value, 'displayName'))
    .filter((value): value is NamedRef => value !== null),
  notificationPreferences: user.notificationPreferences,
  lastSeenAt: timestamp(user.lastSeenAt),
  createdAt: timestamp(user.createdAt),
});

export interface StaffOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const serialiseStaffOption = (user: UserRecord): StaffOption => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
});

export interface MeView {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string;
  status: string;
  phone: string | null;
  image: string | null;
  linkedClients: string[];
  pinnedClients: string[];
  notificationPreferences: UserAttributes['notificationPreferences'];
  unlinked: boolean;
  permissions: Record<Capability, boolean>;
}

export const serialiseMe = (user: AuthenticatedUser, image: string | null): MeView => ({
  id: user.id.toString(),
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified,
  role: user.role,
  status: user.status,
  phone: null,
  image,
  linkedClients: user.linkedClients.map((id) => id.toString()),
  pinnedClients: user.pinnedClients.map((id) => id.toString()),
  notificationPreferences: user.notificationPreferences,
  unlinked: user.role === 'client' && user.linkedClients.length === 0,
  permissions: renderPermissions(user.role),
});

export interface SessionView {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  current: boolean;
}

export const serialiseSession = (session: SessionSummary): SessionView => ({
  id: session.id,
  ipAddress: session.ipAddress,
  userAgent: session.userAgent,
  createdAt: timestamp(session.createdAt),
  expiresAt: timestamp(session.expiresAt),
  current: session.current,
});
