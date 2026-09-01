import type { QueryFilter, Types } from 'mongoose';

import { todayIST } from '../lib/date.js';
import { CLOSED_COMPLIANCE_STATUSES, COMPLIANCE_TRANSITIONS } from '../lib/enums.js';
import type { ComplianceCategory, ComplianceStatus, PeriodType } from '../lib/enums.js';
import { conflict, notFound, validationFailed } from '../lib/errors.js';
import type { PageRequest } from '../lib/pagination.js';
import { parseSort, withTiebreak } from '../lib/pagination.js';
import { periodContaining } from '../lib/period.js';
import type { ComplianceItemAttributes } from '../models/complianceItem.model.js';
import { ComplianceItem } from '../models/complianceItem.model.js';
import { ComplianceType } from '../models/complianceType.model.js';
import { Client } from '../models/client.model.js';
import { DocumentRequest } from '../models/documentRequest.model.js';
import type { AuthenticatedUser, RequestActor } from '../types/context.js';
import type { Lean } from '../types/lean.js';
import { buildDiff, recordAudit } from './audit.service.js';
import { notifyLinkedClientUsers } from './notification.service.js';

export const COMPLIANCE_SORT_FIELDS = ['dueDate', 'periodStart', 'createdAt'] as const;

export interface ComplianceListQuery {
  client?: string;
  complianceType?: string;
  category?: ComplianceCategory;
  status?: ComplianceStatus;
  assignedTo?: string;
  overdue?: boolean;
  dueFrom?: Date;
  dueTo?: Date;
  periodStart?: Date;
  sort?: string;
}

export const isOverdue = (item: {
  dueDate: Date;
  status: ComplianceStatus;
}): boolean =>
  item.dueDate.getTime() < todayIST().getTime() &&
  !CLOSED_COMPLIANCE_STATUSES.includes(item.status);

export const accessibleClientIds = async (
  user: AuthenticatedUser,
): Promise<Types.ObjectId[] | null> => {
  if (user.role === 'admin') return null;
  if (user.role === 'client') return user.linkedClients;
  const clients = await Client.find({ assignedStaff: user.id }).select('_id').lean().exec();
  return clients.map((client) => client._id);
};

const typeIdsForCategory = async (category: ComplianceCategory): Promise<Types.ObjectId[]> => {
  const types = await ComplianceType.find({ category }).select('_id').lean().exec();
  return types.map((type) => type._id);
};

export const buildComplianceFilter = async (
  user: AuthenticatedUser,
  query: ComplianceListQuery,
): Promise<QueryFilter<ComplianceItemAttributes>> => {
  const filter: QueryFilter<ComplianceItemAttributes> = {};
  const scoped = await accessibleClientIds(user);

  if (query.client) {
    if (scoped !== null && !scoped.some((id) => id.toString() === query.client)) {
      throw notFound('client');
    }
    filter.client = query.client;
  } else if (scoped !== null) {
    filter.client = { $in: scoped };
  }

  if (query.complianceType) filter.complianceType = query.complianceType;
  if (query.category) filter.complianceType = { $in: await typeIdsForCategory(query.category) };
  if (query.status) filter.status = query.status;
  if (query.assignedTo) filter.assignedStaff = query.assignedTo;
  if (query.periodStart) filter.periodStart = query.periodStart;
  if (query.dueFrom || query.dueTo) {
    filter.dueDate = {
      ...(query.dueFrom ? { $gte: query.dueFrom } : {}),
      ...(query.dueTo ? { $lte: query.dueTo } : {}),
    };
  }
  if (query.overdue === true) {
    filter.status = { $nin: CLOSED_COMPLIANCE_STATUSES };
    filter.dueDate = { ...(filter.dueDate as object), $lt: todayIST() };
  }
  return filter;
};

const POPULATE = [
  { path: 'client', select: 'displayName clientType status' },
  { path: 'complianceType', select: 'name code category' },
  { path: 'assignedStaff', select: 'name email role' },
] as const;

export const listCompliance = async (
  user: AuthenticatedUser,
  query: ComplianceListQuery,
  page: PageRequest,
): Promise<{ items: Lean<ComplianceItemAttributes>[]; total: number }> => {
  const filter = await buildComplianceFilter(user, query);
  const sort = withTiebreak(
    parseSort<(typeof COMPLIANCE_SORT_FIELDS)[number]>(query.sort, COMPLIANCE_SORT_FIELDS, {
      dueDate: 1,
    }),
  );
  const [items, total] = await Promise.all([
    ComplianceItem.find(filter)
      .sort(sort)
      .skip(page.skip)
      .limit(page.limit)
      .populate([...POPULATE])
      .lean<Lean<ComplianceItemAttributes>[]>()
      .exec(),
    ComplianceItem.countDocuments(filter).exec(),
  ]);
  return { items, total };
};

export const allComplianceInScope = async (
  user: AuthenticatedUser,
  query: ComplianceListQuery,
  cap = 5000,
): Promise<Lean<ComplianceItemAttributes>[]> => {
  const filter = await buildComplianceFilter(user, query);
  return ComplianceItem.find(filter)
    .sort({ dueDate: 1 })
    .limit(cap)
    .populate([...POPULATE])
    .lean<Lean<ComplianceItemAttributes>[]>()
    .exec();
};

export const getComplianceItem = async (
  id: Types.ObjectId,
): Promise<Lean<ComplianceItemAttributes>> => {
  const record = await ComplianceItem.findById(id)
    .populate([...POPULATE])
    .lean<Lean<ComplianceItemAttributes> | null>()
    .exec();
  if (!record) throw notFound('filing');
  return record;
};

export const clientIdOfItem = async (id: Types.ObjectId): Promise<Types.ObjectId> => {
  const record = await ComplianceItem.findById(id).select('client').lean().exec();
  if (!record) throw notFound('filing');
  return record.client;
};

export const requestProgressFor = async (
  itemIds: readonly Types.ObjectId[],
): Promise<Map<string, { received: number; total: number }>> => {
  const out = new Map<string, { received: number; total: number }>();
  if (itemIds.length === 0) return out;
  const rows = await DocumentRequest.aggregate<{
    _id: Types.ObjectId;
    total: number;
    received: number;
  }>([
    { $match: { complianceItem: { $in: [...itemIds] }, status: { $ne: 'cancelled' } } },
    {
      $group: {
        _id: '$complianceItem',
        total: { $sum: 1 },
        received: { $sum: { $cond: [{ $eq: ['$status', 'fulfilled'] }, 1, 0] } },
      },
    },
  ]).exec();
  for (const row of rows) {
    out.set(row._id.toString(), { received: row.received, total: row.total });
  }
  return out;
};

export interface ComplianceCreateInput {
  clientId: Types.ObjectId;
  complianceTypeId: string;
  periodType: PeriodType;
  periodAnchor: Date;
  dueDate?: Date;
  assignedStaff?: string | null;
  notes?: string | null;
}

export const createComplianceItem = async (
  input: ComplianceCreateInput,
  actor: RequestActor,
): Promise<Lean<ComplianceItemAttributes>> => {
  const type = await ComplianceType.findById(input.complianceTypeId).lean().exec();
  if (!type) throw notFound('compliance type');
  const period = periodContaining(input.periodType, input.periodAnchor);

  const duplicate = await ComplianceItem.findOne({
    client: input.clientId,
    complianceType: input.complianceTypeId,
    periodStart: period.periodStart,
  })
    .select('_id')
    .lean()
    .exec();
  if (duplicate) {
    throw conflict(`${type.name} for ${period.periodLabel} already exists for this client.`);
  }

  const created = await ComplianceItem.create({
    client: input.clientId,
    complianceType: input.complianceTypeId,
    clientService: null,
    periodType: period.periodType,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    periodLabel: period.periodLabel,
    dueDate: input.dueDate ?? period.periodEnd,
    dueDateOverridden: input.dueDate !== undefined,
    status: 'pending',
    assignedStaff: input.assignedStaff ?? null,
    notes: input.notes ?? null,
    generatedBy: 'manual',
    createdBy: actor.id,
    updatedBy: actor.id,
  });

  await recordAudit({
    actor,
    action: 'create',
    entityKind: 'complianceItem',
    entityId: created._id,
    client: input.clientId,
    summary: `Created ${type.name} for ${period.periodLabel}`,
  });
  return getComplianceItem(created._id);
};

export interface ComplianceUpdateInput {
  dueDate?: Date;
  assignedStaff?: string | null;
  notes?: string | null;
  acknowledgementRef?: string | null;
}

export const updateComplianceItem = async (
  id: Types.ObjectId,
  input: ComplianceUpdateInput,
  actor: RequestActor,
): Promise<Lean<ComplianceItemAttributes>> => {
  const doc = await ComplianceItem.findById(id).exec();
  if (!doc) throw notFound('filing');

  const before = {
    dueDate: doc.dueDate,
    assignedStaff: doc.assignedStaff,
    notes: doc.notes,
    acknowledgementRef: doc.acknowledgementRef,
  };

  if (input.dueDate !== undefined && input.dueDate.getTime() !== doc.dueDate.getTime()) {
    doc.dueDate = input.dueDate;
    doc.dueDateOverridden = true;
  }
  if (input.assignedStaff !== undefined) doc.set('assignedStaff', input.assignedStaff);
  if (input.notes !== undefined) doc.notes = input.notes;
  if (input.acknowledgementRef !== undefined) doc.acknowledgementRef = input.acknowledgementRef;
  doc.set('updatedBy', actor.id);
  await doc.save();

  const diff = buildDiff(before, {
    dueDate: doc.dueDate,
    assignedStaff: doc.assignedStaff,
    notes: doc.notes,
    acknowledgementRef: doc.acknowledgementRef,
  });
  if (diff.length > 0) {
    await recordAudit({
      actor,
      action: 'update',
      entityKind: 'complianceItem',
      entityId: doc._id,
      client: doc.client,
      summary: doc.dueDateOverridden ? 'Updated a filing, due date overridden' : 'Updated a filing',
      diff,
    });
  }
  return getComplianceItem(id);
};

export interface StatusChangeInput {
  status: ComplianceStatus;
  filedDate?: Date;
  notApplicableReason?: string;
}

export const changeComplianceStatus = async (
  id: Types.ObjectId,
  input: StatusChangeInput,
  actor: RequestActor,
): Promise<Lean<ComplianceItemAttributes>> => {
  const doc = await ComplianceItem.findById(id).exec();
  if (!doc) throw notFound('filing');

  const allowed = COMPLIANCE_TRANSITIONS[doc.status];
  if (doc.status !== input.status && !allowed.includes(input.status)) {
    throw conflict(
      doc.status === 'acknowledged'
        ? 'An acknowledged filing is final. Delete and recreate it if it was recorded in error.'
        : `A filing marked not applicable can only return to pending.`,
    );
  }

  if ((input.status === 'filed' || input.status === 'acknowledged') && !input.filedDate) {
    throw validationFailed('Record the date this was filed.', [
      { field: 'filedDate', message: 'Enter the date the return was filed.' },
    ]);
  }
  if (input.status === 'not_applicable' && !input.notApplicableReason) {
    throw validationFailed('Say why this filing does not apply.', [
      { field: 'notApplicableReason', message: 'A short reason is enough.' },
    ]);
  }

  const before = { status: doc.status, filedDate: doc.filedDate };
  doc.status = input.status;
  doc.filedDate =
    input.status === 'filed' || input.status === 'acknowledged'
      ? (input.filedDate ?? doc.filedDate ?? null)
      : null;
  doc.notApplicableReason =
    input.status === 'not_applicable' ? (input.notApplicableReason ?? null) : null;
  doc.set('updatedBy', actor.id);
  await doc.save();

  await recordAudit({
    actor,
    action: 'status_change',
    entityKind: 'complianceItem',
    entityId: doc._id,
    client: doc.client,
    summary: `Filing moved from ${before.status} to ${doc.status}`,
    diff: buildDiff(before, { status: doc.status, filedDate: doc.filedDate }),
  });

  if (input.status === 'awaiting_client' && before.status !== 'awaiting_client') {
    const type = await ComplianceType.findById(doc.complianceType).select('name').lean().exec();
    await notifyLinkedClientUsers(doc.client, {
      type: 'awaiting_client',
      title: `${type?.name ?? 'A filing'} needs something from you`,
      body: `${doc.periodLabel} is waiting on you before your firm can proceed.`,
      link: '/portal/compliance',
      entity: { kind: 'complianceItem', id: doc._id },
      dedupeKey: `awaiting:${doc._id.toString()}`,
    });
  }
  return getComplianceItem(id);
};

export const deleteComplianceItem = async (
  id: Types.ObjectId,
  actor: RequestActor,
): Promise<void> => {
  const doc = await ComplianceItem.findById(id).exec();
  if (!doc) throw notFound('filing');
  if (doc.status !== 'pending') {
    throw conflict('Only a filing still marked pending can be deleted.');
  }
  const clientId = doc.client;
  await doc.deleteOne();
  await recordAudit({
    actor,
    action: 'hard_delete',
    entityKind: 'complianceItem',
    entityId: id,
    client: clientId,
    summary: 'Deleted a pending filing',
  });
};
