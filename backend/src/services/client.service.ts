import type { QueryFilter, Types } from 'mongoose';

import { env } from '../config/env.js';
import { conflict, forbidden, notFound, validationFailed } from '../lib/errors.js';
import { decryptField, encryptField } from '../lib/crypto.js';
import { escapeRegex, normaliseAadhaar } from '../lib/identifiers.js';
import { containsId, sameId } from '../lib/scope.js';
import { todayIST } from '../lib/date.js';
import type { PageRequest } from '../lib/pagination.js';
import { parseSort, withTiebreak } from '../lib/pagination.js';
import type { ClientAttributes, ClientDocument } from '../models/client.model.js';
import { Client } from '../models/client.model.js';
import { ComplianceItem } from '../models/complianceItem.model.js';
import { DocumentRequest } from '../models/documentRequest.model.js';
import { Message } from '../models/message.model.js';
import { User } from '../models/user.model.js';
import type { AuthenticatedUser, RequestActor } from '../types/context.js';
import type { Lean } from '../types/lean.js';
import { buildDiff, recordAudit } from './audit.service.js';

export const CLIENT_SORT_FIELDS = ['displayName', 'createdAt', 'status'] as const;

export interface ClientListQuery {
  q?: string;
  status?: ClientAttributes['status'];
  clientType?: ClientAttributes['clientType'];
  assignedTo?: string;
  archived?: boolean;
  pinned?: boolean;
  sort?: string;
}

export interface ClientListExtras {
  nextDueDate: Date | null;
  openRequestCount: number;
  unreadMessageCount: number;
  pinned: boolean;
}

export const scopeFilterFor = (user: AuthenticatedUser): QueryFilter<ClientAttributes> => {
  switch (user.role) {
    case 'admin':
      return {};
    case 'staff':
      return { assignedStaff: user.id };
    case 'client':
      return { _id: { $in: user.linkedClients } };
  }
};

const buildListFilter = (
  user: AuthenticatedUser,
  query: ClientListQuery,
): QueryFilter<ClientAttributes> => {
  const filter: QueryFilter<ClientAttributes> = {
    ...scopeFilterFor(user),
    archived: query.archived ?? false,
  };
  if (query.status) filter.status = query.status;
  if (query.clientType) filter.clientType = query.clientType;
  if (query.assignedTo) {
    filter.assignedStaff =
      user.role === 'staff' ? { $all: [user.id, query.assignedTo] } : query.assignedTo;
  }
  if (query.pinned === true) filter._id = { $in: user.pinnedClients };
  if (query.q && query.q.trim().length > 0) {
    const pattern = new RegExp(escapeRegex(query.q.trim()), 'i');
    filter.$or = [
      { displayName: pattern },
      { legalName: pattern },
      { pan: pattern },
      { gstin: pattern },
    ];
  }
  return filter;
};

export const listClientExtras = async (
  user: AuthenticatedUser,
  clientIds: readonly Types.ObjectId[],
): Promise<Map<string, ClientListExtras>> => {
  const out = new Map<string, ClientListExtras>();
  if (clientIds.length === 0) return out;

  const [dueRows, requestRows, unreadRows] = await Promise.all([
    ComplianceItem.aggregate<{ _id: Types.ObjectId; nextDueDate: Date }>([
      {
        $match: {
          client: { $in: [...clientIds] },
          status: { $nin: ['filed', 'acknowledged', 'not_applicable'] },
        },
      },
      { $group: { _id: '$client', nextDueDate: { $min: '$dueDate' } } },
    ]).exec(),
    DocumentRequest.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { client: { $in: [...clientIds] }, status: 'open' } },
      { $group: { _id: '$client', count: { $sum: 1 } } },
    ]).exec(),
    Message.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          client: { $in: [...clientIds] },
          readBy: { $ne: user.id },
          author: { $ne: user.id },
        },
      },
      { $group: { _id: '$client', count: { $sum: 1 } } },
    ]).exec(),
  ]);

  const dueMap = new Map(dueRows.map((row) => [row._id.toString(), row.nextDueDate]));
  const requestMap = new Map(requestRows.map((row) => [row._id.toString(), row.count]));
  const unreadMap = new Map(unreadRows.map((row) => [row._id.toString(), row.count]));

  for (const clientId of clientIds) {
    const key = clientId.toString();
    out.set(key, {
      nextDueDate: dueMap.get(key) ?? null,
      openRequestCount: requestMap.get(key) ?? 0,
      unreadMessageCount: unreadMap.get(key) ?? 0,
      pinned: containsId(user.pinnedClients, clientId),
    });
  }
  return out;
};

export const listClients = async (
  user: AuthenticatedUser,
  query: ClientListQuery,
  page: PageRequest,
): Promise<{
  items: Lean<ClientAttributes>[];
  total: number;
  extras: Map<string, ClientListExtras>;
}> => {
  const filter = buildListFilter(user, query);
  const sort = withTiebreak(
    parseSort<(typeof CLIENT_SORT_FIELDS)[number]>(query.sort, CLIENT_SORT_FIELDS, {
      displayName: 1,
    }),
  );
  const [items, total] = await Promise.all([
    Client.find(filter)
      .sort(sort)
      .skip(page.skip)
      .limit(page.limit)
      .populate('assignedStaff', 'name email role')
      .lean<Lean<ClientAttributes>[]>()
      .exec(),
    Client.countDocuments(filter).exec(),
  ]);
  const extras = await listClientExtras(
    user,
    items.map((item) => item._id),
  );
  return { items, total, extras };
};

export const allClientsInScope = async (
  user: AuthenticatedUser,
  query: ClientListQuery,
  cap = 5000,
): Promise<Lean<ClientAttributes>[]> =>
  Client.find(buildListFilter(user, query))
    .sort({ displayName: 1 })
    .limit(cap)
    .populate('assignedStaff', 'name email role')
    .lean<Lean<ClientAttributes>[]>()
    .exec();

export const getClientOrThrow = async (clientId: Types.ObjectId): Promise<ClientDocument> => {
  const record = await Client.findById(clientId).exec();
  if (!record) throw notFound('client');
  return record;
};

export const getClientDetail = async (clientId: Types.ObjectId): Promise<Lean<ClientAttributes>> => {
  const record = await Client.findById(clientId)
    .populate('assignedStaff', 'name email role')
    .lean<Lean<ClientAttributes> | null>()
    .exec();
  if (!record) throw notFound('client');
  return record;
};

export interface ClientWritePayload {
  clientType?: ClientAttributes['clientType'];
  displayName?: string;
  legalName?: string | null;
  status?: ClientAttributes['status'];
  pan?: string | null;
  aadhaar?: string | null;
  gstin?: string | null;
  tan?: string | null;
  cin?: string | null;
  entityType?: ClientAttributes['entityType'];
  incorporationDate?: Date | null;
  dateOfBirth?: Date | null;
  primaryContact?: ClientAttributes['primaryContact'];
  additionalContacts?: ClientAttributes['additionalContacts'];
  address?: ClientAttributes['address'];
  assignedStaff?: string[];
  notes?: string | null;
}

const applyAadhaar = (doc: ClientDocument, aadhaar: string | null | undefined): void => {
  if (aadhaar === undefined) return;
  if (aadhaar === null || aadhaar.length === 0) {
    doc.set('aadhaarEncrypted', null);
    return;
  }
  const digits = normaliseAadhaar(aadhaar);
  doc.set(
    'aadhaarEncrypted',
    encryptField(digits, env.FIELD_ENCRYPTION_KEY, env.FIELD_ENCRYPTION_KEY_VERSION),
  );
};

const assertStaffExist = async (staffIds: readonly string[]): Promise<void> => {
  if (staffIds.length === 0) return;
  const found = await User.countDocuments({
    _id: { $in: [...staffIds] },
    role: { $in: ['staff', 'admin'] },
    status: 'active',
  }).exec();
  if (found !== new Set(staffIds).size) {
    throw validationFailed('One of the chosen staff members no longer exists or is inactive.', [
      { field: 'assignedStaff', message: 'Choose active staff members only.' },
    ]);
  }
};

export const createClient = async (
  payload: ClientWritePayload,
  actor: RequestActor,
): Promise<Lean<ClientAttributes>> => {
  if (payload.assignedStaff) await assertStaffExist(payload.assignedStaff);
  const doc = new Client({
    clientType: payload.clientType,
    displayName: payload.displayName,
    legalName: payload.legalName ?? null,
    status: payload.status ?? 'onboarding',
    pan: payload.pan ?? null,
    gstin: payload.gstin ?? null,
    tan: payload.tan ?? null,
    cin: payload.cin ?? null,
    entityType: payload.entityType ?? null,
    incorporationDate: payload.incorporationDate ?? null,
    dateOfBirth: payload.dateOfBirth ?? null,
    primaryContact: payload.primaryContact,
    additionalContacts: payload.additionalContacts ?? [],
    address: payload.address ?? null,
    assignedStaff: payload.assignedStaff ?? [],
    notes: payload.notes ?? null,
    createdBy: actor.id,
    updatedBy: actor.id,
  });
  applyAadhaar(doc, payload.aadhaar);
  await doc.save();

  await recordAudit({
    actor,
    action: 'create',
    entityKind: 'client',
    entityId: doc._id,
    client: doc._id,
    summary: `Created client ${doc.displayName}`,
  });
  return getClientDetail(doc._id);
};

const AUDITABLE_FIELDS = [
  'displayName',
  'legalName',
  'status',
  'pan',
  'gstin',
  'tan',
  'cin',
  'entityType',
  'incorporationDate',
  'dateOfBirth',
  'primaryContact',
  'additionalContacts',
  'address',
  'assignedStaff',
  'notes',
  'aadhaarEncrypted',
] as const;

const snapshot = (doc: ClientDocument): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const field of AUDITABLE_FIELDS) {
    out[field] = doc.get(field);
  }
  return out;
};

export const updateClient = async (
  clientId: Types.ObjectId,
  payload: ClientWritePayload,
  actor: RequestActor,
): Promise<Lean<ClientAttributes>> => {
  const doc = await Client.findById(clientId).select('+aadhaarEncrypted').exec();
  if (!doc) throw notFound('client');
  if (doc.archived) {
    throw conflict('This client is archived and read-only. Restore it before making changes.');
  }
  if (payload.clientType !== undefined && payload.clientType !== doc.clientType) {
    throw conflict('A client cannot change between individual and business after creation.');
  }
  if (payload.assignedStaff) await assertStaffExist(payload.assignedStaff);

  const before = snapshot(doc);
  for (const field of AUDITABLE_FIELDS) {
    if (field === 'aadhaarEncrypted') continue;
    const value = payload[field as keyof ClientWritePayload];
    if (value !== undefined) doc.set(field, value);
  }
  applyAadhaar(doc, payload.aadhaar);
  doc.set('updatedBy', actor.id);
  await doc.save();

  const diff = buildDiff(before, snapshot(doc));
  if (diff.length > 0) {
    await recordAudit({
      actor,
      action: 'update',
      entityKind: 'client',
      entityId: doc._id,
      client: doc._id,
      summary: `Updated client ${doc.displayName}`,
      diff,
    });
  }
  return getClientDetail(doc._id);
};

export const setArchived = async (
  clientId: Types.ObjectId,
  archived: boolean,
  actor: RequestActor,
): Promise<Lean<ClientAttributes>> => {
  const doc = await getClientOrThrow(clientId);
  if (doc.archived === archived) return getClientDetail(clientId);
  doc.archived = archived;
  doc.archivedAt = archived ? new Date() : null;
  doc.archivedBy = archived ? actor.id : null;
  await doc.save();
  await recordAudit({
    actor,
    action: archived ? 'archive' : 'restore',
    entityKind: 'client',
    entityId: doc._id,
    client: doc._id,
    summary: `${archived ? 'Archived' : 'Restored'} client ${doc.displayName}`,
  });
  return getClientDetail(clientId);
};

export const setAssignments = async (
  clientId: Types.ObjectId,
  staffIds: string[],
  actor: RequestActor,
): Promise<{ client: Lean<ClientAttributes>; orphanedOpenItems: number }> => {
  await assertStaffExist(staffIds);
  const doc = await getClientOrThrow(clientId);
  const removed = doc.assignedStaff.filter((id) => !staffIds.some((next) => sameId(id, next)));
  const before = { assignedStaff: [...doc.assignedStaff] };
  doc.set('assignedStaff', staffIds);
  doc.set('updatedBy', actor.id);
  await doc.save();

  const orphanedOpenItems =
    removed.length === 0
      ? 0
      : await ComplianceItem.countDocuments({
          client: clientId,
          assignedStaff: { $in: removed },
          status: { $nin: ['filed', 'acknowledged', 'not_applicable'] },
        }).exec();

  await recordAudit({
    actor,
    action: 'assign',
    entityKind: 'client',
    entityId: clientId,
    client: clientId,
    summary: `Assigned ${staffIds.length} staff to ${doc.displayName}`,
    diff: buildDiff(before, { assignedStaff: staffIds }),
  });
  return { client: await getClientDetail(clientId), orphanedOpenItems };
};

export const setPinned = async (
  user: AuthenticatedUser,
  clientId: Types.ObjectId,
  pinned: boolean,
): Promise<void> => {
  await User.updateOne(
    { _id: user.id },
    pinned ? { $addToSet: { pinnedClients: clientId } } : { $pull: { pinnedClients: clientId } },
  ).exec();
};

export const revealAadhaar = async (
  clientId: Types.ObjectId,
  actor: RequestActor,
): Promise<string> => {
  if (actor.role !== 'admin' && actor.role !== 'client') throw forbidden();
  const record = await Client.findById(clientId)
    .select('+aadhaarEncrypted displayName clientType')
    .lean<Lean<ClientAttributes> | null>()
    .exec();
  if (!record) throw notFound('client');
  if (!record.aadhaarEncrypted) throw notFound('Aadhaar number');

  const value = decryptField(record.aadhaarEncrypted, env.FIELD_ENCRYPTION_KEY);
  await recordAudit({
    actor,
    action: 'reveal_aadhaar',
    entityKind: 'client',
    entityId: clientId,
    client: clientId,
    summary: `Revealed the Aadhaar number held for ${record.displayName}`,
  });
  return value;
};

export const clientHasAadhaar = async (clientId: Types.ObjectId): Promise<boolean> => {
  const record = await Client.findById(clientId)
    .select('+aadhaarEncrypted')
    .lean<{ aadhaarEncrypted?: unknown } | null>()
    .exec();
  return Boolean(record?.aadhaarEncrypted);
};

export const nextDueDateFor = async (clientId: Types.ObjectId): Promise<Date | null> => {
  const row = await ComplianceItem.findOne({
    client: clientId,
    status: { $nin: ['filed', 'acknowledged', 'not_applicable'] },
    dueDate: { $gte: todayIST() },
  })
    .sort({ dueDate: 1 })
    .select('dueDate')
    .lean()
    .exec();
  return row?.dueDate ?? null;
};
