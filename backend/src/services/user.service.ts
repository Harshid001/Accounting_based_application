import type { QueryFilter, Types } from 'mongoose';

import type { Role, UserStatus } from '../lib/enums.js';
import { conflict, notFound, validationFailed } from '../lib/errors.js';
import { escapeRegex } from '../lib/identifiers.js';
import type { PageRequest } from '../lib/pagination.js';
import { Client } from '../models/client.model.js';
import { Session } from '../models/session.model.js';
import type { NotificationPreferences, UserAttributes } from '../models/user.model.js';
import { User } from '../models/user.model.js';
import type { RequestActor } from '../types/context.js';
import type { Lean } from '../types/lean.js';
import { buildDiff, recordAudit } from './audit.service.js';

export interface UserListQuery {
  role?: Role;
  status?: UserStatus;
  q?: string;
  unlinked?: boolean;
}

export const listUsers = async (
  query: UserListQuery,
  page: PageRequest,
): Promise<{ items: Lean<UserAttributes>[]; total: number }> => {
  const filter: QueryFilter<UserAttributes> = {};
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  if (query.unlinked === true) {
    filter.role = 'client';
    filter.linkedClients = { $size: 0 };
  }
  if (query.q && query.q.trim().length > 0) {
    const pattern = new RegExp(escapeRegex(query.q.trim()), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }
  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ role: 1, name: 1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate('linkedClients', 'displayName')
      .lean<Lean<UserAttributes>[]>()
      .exec(),
    User.countDocuments(filter).exec(),
  ]);
  return { items, total };
};

export const getUser = async (id: Types.ObjectId): Promise<Lean<UserAttributes>> => {
  const record = await User.findById(id)
    .populate('linkedClients', 'displayName')
    .lean<Lean<UserAttributes> | null>()
    .exec();
  if (!record) throw notFound('account');
  return record;
};

export interface SelfUpdate {
  name?: string;
  phone?: string | null;
  image?: string | null;
  notificationPreferences?: Partial<NotificationPreferences>;
}

export const updateSelf = async (
  id: Types.ObjectId,
  patch: SelfUpdate,
  actor: RequestActor,
): Promise<Lean<UserAttributes>> => {
  const doc = await User.findById(id).exec();
  if (!doc) throw notFound('account');
  const before = {
    name: doc.name,
    phone: doc.phone,
    image: doc.image,
    notificationPreferences: { ...doc.notificationPreferences },
  };
  if (patch.name !== undefined) doc.name = patch.name;
  if (patch.phone !== undefined) doc.phone = patch.phone;
  if (patch.image !== undefined) doc.image = patch.image;
  if (patch.notificationPreferences) {
    doc.notificationPreferences = {
      ...doc.notificationPreferences,
      ...patch.notificationPreferences,
    };
  }
  await doc.save();
  const diff = buildDiff(before, {
    name: doc.name,
    phone: doc.phone,
    image: doc.image,
    notificationPreferences: { ...doc.notificationPreferences },
  });
  if (diff.length > 0) {
    await recordAudit({
      actor,
      action: 'update',
      entityKind: 'user',
      entityId: doc._id,
      summary: 'Updated own profile',
      diff,
    });
  }
  return getUser(id);
};

export const adminUpdateUser = async (
  id: Types.ObjectId,
  patch: { name?: string; phone?: string | null },
  actor: RequestActor,
): Promise<Lean<UserAttributes>> => {
  const doc = await User.findById(id).exec();
  if (!doc) throw notFound('account');
  const before = { name: doc.name, phone: doc.phone };
  if (patch.name !== undefined) doc.name = patch.name;
  if (patch.phone !== undefined) doc.phone = patch.phone;
  await doc.save();
  const diff = buildDiff(before, { name: doc.name, phone: doc.phone });
  if (diff.length > 0) {
    await recordAudit({
      actor,
      action: 'update',
      entityKind: 'user',
      entityId: doc._id,
      summary: `Updated the profile of ${doc.email}`,
      diff,
    });
  }
  return getUser(id);
};

export const revokeSessionsFor = async (userId: Types.ObjectId): Promise<number> => {
  const result = await Session.deleteMany({ userId }).exec();
  return result.deletedCount;
};

const assertNotLastAdmin = async (userId: Types.ObjectId): Promise<void> => {
  const admins = await User.countDocuments({ role: 'admin', status: 'active' }).exec();
  const target = await User.findById(userId).select('role status').lean().exec();
  if (target?.role === 'admin' && target.status === 'active' && admins <= 1) {
    throw conflict(
      'This is the last active administrator. Promote someone else first, then make this change.',
    );
  }
};

export const changeRole = async (
  id: Types.ObjectId,
  role: Role,
  actor: RequestActor,
): Promise<Lean<UserAttributes>> => {
  const doc = await User.findById(id).exec();
  if (!doc) throw notFound('account');
  if (doc.role === role) return getUser(id);
  if (doc.role === 'admin') await assertNotLastAdmin(id);

  const before = { role: doc.role, linkedClients: [...doc.linkedClients] };
  doc.role = role;
  if (role !== 'client') doc.set('linkedClients', []);
  await doc.save();
  await revokeSessionsFor(id);

  await recordAudit({
    actor,
    action: 'role_change',
    entityKind: 'user',
    entityId: doc._id,
    summary: `Changed the role of ${doc.email} from ${before.role} to ${role}`,
    diff: buildDiff(before, { role: doc.role, linkedClients: [...doc.linkedClients] }),
  });
  return getUser(id);
};

export const setLinkedClients = async (
  id: Types.ObjectId,
  clientIds: string[],
  actor: RequestActor,
): Promise<Lean<UserAttributes>> => {
  const doc = await User.findById(id).exec();
  if (!doc) throw notFound('account');
  if (doc.role !== 'client') {
    throw conflict('Only a client account can be linked to client records.');
  }
  if (clientIds.length > 0) {
    const found = await Client.countDocuments({ _id: { $in: clientIds } }).exec();
    if (found !== new Set(clientIds).size) {
      throw validationFailed('One of those client records no longer exists.', [
        { field: 'clientIds', message: 'Choose client records that still exist.' },
      ]);
    }
  }
  const before = { linkedClients: [...doc.linkedClients] };
  doc.set('linkedClients', clientIds);
  await doc.save();
  await recordAudit({
    actor,
    action: 'update',
    entityKind: 'user',
    entityId: doc._id,
    summary: `Linked ${doc.email} to ${clientIds.length} client record${clientIds.length === 1 ? '' : 's'}`,
    diff: buildDiff(before, { linkedClients: [...doc.linkedClients] }),
  });
  return getUser(id);
};

export const setUserStatus = async (
  id: Types.ObjectId,
  status: UserStatus,
  actor: RequestActor,
): Promise<Lean<UserAttributes>> => {
  const doc = await User.findById(id).exec();
  if (!doc) throw notFound('account');
  if (status === 'deactivated') await assertNotLastAdmin(id);
  if (doc.status === status) return getUser(id);

  doc.status = status;
  await doc.save();
  if (status === 'deactivated') await revokeSessionsFor(id);

  await recordAudit({
    actor,
    action: 'update',
    entityKind: 'user',
    entityId: doc._id,
    summary: `${status === 'deactivated' ? 'Deactivated' : 'Reactivated'} ${doc.email}`,
    diff: buildDiff({ status: doc.status === 'active' ? 'deactivated' : 'active' }, { status }),
  });
  return getUser(id);
};

export const purgeUnlinkedAccounts = async (
  olderThanDays: number,
  actor: RequestActor,
): Promise<number> => {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const candidates = await User.find({
    role: 'client',
    emailVerified: false,
    linkedClients: { $size: 0 },
    createdAt: { $lt: cutoff },
  })
    .select('_id')
    .lean()
    .exec();
  if (candidates.length === 0) return 0;

  const ids = candidates.map((candidate) => candidate._id);
  await Session.deleteMany({ userId: { $in: ids } }).exec();
  await User.deleteMany({ _id: { $in: ids } }).exec();

  await recordAudit({
    actor,
    action: 'hard_delete',
    entityKind: 'user',
    summary: `Purged ${ids.length} unverified, unlinked account${ids.length === 1 ? '' : 's'} older than ${olderThanDays} days`,
  });
  return ids.length;
};

export interface SessionSummary {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
  current: boolean;
}

export const listSessionsFor = async (
  userId: Types.ObjectId,
  currentToken: string | undefined,
): Promise<SessionSummary[]> => {
  const sessions = await Session.find({ userId }).sort({ createdAt: -1 }).lean().exec();
  return sessions.map((session) => ({
    id: session._id.toString(),
    ipAddress: session.ipAddress ?? null,
    userAgent: session.userAgent ?? null,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    current: currentToken !== undefined && session.token === currentToken,
  }));
};

export const revokeOtherSessions = async (
  userId: Types.ObjectId,
  currentToken: string | undefined,
): Promise<number> => {
  const filter =
    currentToken === undefined ? { userId } : { userId, token: { $ne: currentToken } };
  const result = await Session.deleteMany(filter).exec();
  return result.deletedCount;
};
