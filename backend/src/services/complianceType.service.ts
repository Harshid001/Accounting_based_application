import type { QueryFilter, Types } from 'mongoose';

import { conflict, notFound } from '../lib/errors.js';
import type { ComplianceCategory } from '../lib/enums.js';
import { escapeRegex } from '../lib/identifiers.js';
import type { ComplianceTypeAttributes } from '../models/complianceType.model.js';
import { ComplianceType } from '../models/complianceType.model.js';
import { ClientService } from '../models/clientService.model.js';
import { ComplianceItem } from '../models/complianceItem.model.js';
import type { RequestActor } from '../types/context.js';
import type { Lean } from '../types/lean.js';
import { buildDiff, recordAudit } from './audit.service.js';

export interface ComplianceTypeQuery {
  category?: ComplianceCategory;
  active?: boolean;
  isRecurring?: boolean;
  q?: string;
}

export const listComplianceTypes = async (
  query: ComplianceTypeQuery,
): Promise<Lean<ComplianceTypeAttributes>[]> => {
  const filter: QueryFilter<ComplianceTypeAttributes> = {};
  if (query.category) filter.category = query.category;
  if (query.active !== undefined) filter.active = query.active;
  if (query.isRecurring !== undefined) filter.isRecurring = query.isRecurring;
  if (query.q && query.q.trim().length > 0) {
    const pattern = new RegExp(escapeRegex(query.q.trim()), 'i');
    filter.$or = [{ name: pattern }, { code: pattern }];
  }
  return ComplianceType.find(filter)
    .sort({ category: 1, name: 1 })
    .lean<Lean<ComplianceTypeAttributes>[]>()
    .exec();
};

export const getComplianceType = async (
  id: Types.ObjectId,
): Promise<Lean<ComplianceTypeAttributes>> => {
  const record = await ComplianceType.findById(id)
    .lean<Lean<ComplianceTypeAttributes> | null>()
    .exec();
  if (!record) throw notFound('compliance type');
  return record;
};

export type ComplianceTypeWrite = Partial<
  Pick<
    ComplianceTypeAttributes,
    | 'name'
    | 'code'
    | 'category'
    | 'isRecurring'
    | 'defaultFrequency'
    | 'dueDateRule'
    | 'defaultDocumentChecklist'
    | 'reminderOffsetsDays'
    | 'active'
  >
>;

export const createComplianceType = async (
  payload: ComplianceTypeWrite,
  actor: RequestActor,
): Promise<Lean<ComplianceTypeAttributes>> => {
  const created = await ComplianceType.create({
    ...payload,
    isSeeded: false,
    createdBy: actor.id,
    updatedBy: actor.id,
  });
  await recordAudit({
    actor,
    action: 'create',
    entityKind: 'complianceType',
    entityId: created._id,
    summary: `Created catalogue entry ${created.name}`,
  });
  return getComplianceType(created._id);
};

const WRITABLE = [
  'name',
  'category',
  'isRecurring',
  'defaultFrequency',
  'dueDateRule',
  'defaultDocumentChecklist',
  'reminderOffsetsDays',
  'active',
] as const;

export const updateComplianceType = async (
  id: Types.ObjectId,
  payload: ComplianceTypeWrite,
  actor: RequestActor,
): Promise<Lean<ComplianceTypeAttributes>> => {
  const doc = await ComplianceType.findById(id).exec();
  if (!doc) throw notFound('compliance type');
  if (payload.code !== undefined && payload.code !== doc.code) {
    throw conflict('A catalogue code cannot change after the entry is created.');
  }

  const before: Record<string, unknown> = {};
  for (const field of WRITABLE) before[field] = doc.get(field);

  for (const field of WRITABLE) {
    const value = payload[field];
    if (value !== undefined) doc.set(field, value);
  }
  doc.set('updatedBy', actor.id);
  await doc.save();

  const after: Record<string, unknown> = {};
  for (const field of WRITABLE) after[field] = doc.get(field);

  const diff = buildDiff(before, after);
  if (diff.length > 0) {
    await recordAudit({
      actor,
      action: 'update',
      entityKind: 'complianceType',
      entityId: doc._id,
      summary: `Updated catalogue entry ${doc.name}`,
      diff,
    });
  }
  return getComplianceType(id);
};

export const complianceTypeUsage = async (
  id: Types.ObjectId,
): Promise<{ services: number; items: number }> => {
  const [services, items] = await Promise.all([
    ClientService.countDocuments({ complianceType: id }).exec(),
    ComplianceItem.countDocuments({ complianceType: id }).exec(),
  ]);
  return { services, items };
};

export const deleteComplianceType = async (
  id: Types.ObjectId,
  actor: RequestActor,
): Promise<void> => {
  const doc = await ComplianceType.findById(id).exec();
  if (!doc) throw notFound('compliance type');
  const usage = await complianceTypeUsage(id);
  if (usage.services > 0 || usage.items > 0) {
    throw conflict(
      `${doc.name} is in use by ${usage.services} client service${usage.services === 1 ? '' : 's'} and ${usage.items} filing${usage.items === 1 ? '' : 's'}, so it cannot be deleted. Deactivate it instead.`,
    );
  }
  await doc.deleteOne();
  await recordAudit({
    actor,
    action: 'hard_delete',
    entityKind: 'complianceType',
    entityId: id,
    summary: `Deleted unused catalogue entry ${doc.name}`,
  });
};
