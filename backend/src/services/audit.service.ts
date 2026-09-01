import type { QueryFilter, Types } from 'mongoose';

import { logger } from '../config/logger.js';
import type { AuditAction, AuditEntityKind } from '../lib/enums.js';
import { REDACTED_AUDIT_FIELDS } from '../lib/enums.js';
import type { PageRequest } from '../lib/pagination.js';
import { buildPageMeta } from '../lib/pagination.js';
import type { AuditDiffEntry, AuditLogAttributes } from '../models/auditLog.model.js';
import type { Lean } from '../types/lean.js';
import { AuditLog } from '../models/auditLog.model.js';
import type { RequestActor } from '../types/context.js';

const isRedacted = (field: string): boolean =>
  REDACTED_AUDIT_FIELDS.some(
    (candidate) => field === candidate || field.endsWith(`.${candidate}`),
  );

const comparable = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'symbol') return value.toString();
  return `${value as string | number | boolean | bigint}`;
};

const summarise = (value: unknown): unknown => {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((entry) => summarise(entry));
  if (value !== null && typeof value === 'object') {
    return JSON.parse(JSON.stringify(value)) as unknown;
  }
  return value;
};

export const buildDiff = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): AuditDiffEntry[] => {
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diff: AuditDiffEntry[] = [];
  for (const field of fields) {
    const previous = before[field];
    const next = after[field];
    if (comparable(previous) === comparable(next)) continue;
    if (isRedacted(field)) {
      diff.push({ field, redacted: true });
      continue;
    }
    diff.push({ field, before: summarise(previous), after: summarise(next), redacted: false });
  }
  return diff;
};

export interface AuditInput {
  actor: RequestActor;
  action: AuditAction;
  entityKind: AuditEntityKind;
  entityId?: Types.ObjectId | null;
  client?: Types.ObjectId | null;
  summary?: string;
  diff?: AuditDiffEntry[];
}

export const recordAudit = async (input: AuditInput): Promise<void> => {
  try {
    await AuditLog.create({
      actor: input.actor.id,
      actorRole: input.actor.role,
      action: input.action,
      entityKind: input.entityKind,
      entityId: input.entityId ?? null,
      client: input.client ?? null,
      summary: input.summary ?? null,
      diff: (input.diff ?? []).map((entry) =>
        entry.redacted ? { field: entry.field, redacted: true } : entry,
      ),
      ip: input.actor.ip,
      userAgent: input.actor.userAgent?.slice(0, 400) ?? null,
      requestId: input.actor.requestId,
    });
  } catch (error) {
    logger.error(
      { event: 'audit.write_failed', action: input.action, entityKind: input.entityKind, err: error },
      'an audit entry could not be written',
    );
  }
};

export interface AuditQuery {
  actor?: string;
  entityKind?: AuditEntityKind;
  entityId?: string;
  client?: string;
  action?: AuditAction;
  dateFrom?: Date;
  dateTo?: Date;
}

export const listAudit = async (
  query: AuditQuery,
  page: PageRequest,
): Promise<{ items: Lean<AuditLogAttributes>[]; total: number }> => {
  const filter: QueryFilter<AuditLogAttributes> = {};
  if (query.actor) filter.actor = query.actor;
  if (query.entityKind) filter.entityKind = query.entityKind;
  if (query.entityId) filter.entityId = query.entityId;
  if (query.client) filter.client = query.client;
  if (query.action) filter.action = query.action;
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {
      ...(query.dateFrom ? { $gte: query.dateFrom } : {}),
      ...(query.dateTo ? { $lte: query.dateTo } : {}),
    };
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate('actor', 'name email role')
      .populate('client', 'displayName')
      .lean<Lean<AuditLogAttributes>[]>()
      .exec(),
    AuditLog.countDocuments(filter).exec(),
  ]);
  return { items, total };
};

export const auditPageMeta = buildPageMeta;
