import type { Types } from 'mongoose';

import type { Role, UserStatus } from '../lib/enums.js';
import type { NotificationPreferences } from '../models/user.model.js';

export interface AuthenticatedUser {
  id: Types.ObjectId;
  name: string;
  email: string;
  emailVerified: boolean;
  role: Role;
  status: UserStatus;
  linkedClients: Types.ObjectId[];
  pinnedClients: Types.ObjectId[];
  notificationPreferences: NotificationPreferences;
}

export interface RequestActor {
  id: Types.ObjectId | null;
  role: Role | 'system';
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export const systemActor = (requestId: string | null = null): RequestActor => ({
  id: null,
  role: 'system',
  ip: null,
  userAgent: null,
  requestId,
});

export const actorFromUser = (
  user: AuthenticatedUser,
  ip: string | null,
  userAgent: string | null,
  requestId: string | null,
): RequestActor => ({
  id: user.id,
  role: user.role,
  ip,
  userAgent,
  requestId,
});
