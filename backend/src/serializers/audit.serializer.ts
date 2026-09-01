import { REDACTED_AUDIT_FIELDS } from '../lib/enums.js';
import type { AuditLogAttributes } from '../models/auditLog.model.js';
import type { Lean } from '../types/lean.js';
import { namedRef, personRef, timestamp } from './common.js';
import type { NamedRef, PersonRef } from './common.js';

export interface AuditDiffView {
  field: string;
  before: unknown;
  after: unknown;
  redacted: boolean;
}

export interface AuditEntryView {
  id: string;
  actor: PersonRef | null;
  actorRole: string | null;
  action: string;
  entityKind: string;
  entityId: string | null;
  client: NamedRef | null;
  summary: string | null;
  diff: AuditDiffView[];
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string | null;
}

const isRedacted = (field: string): boolean =>
  REDACTED_AUDIT_FIELDS.some(
    (candidate) => field === candidate || field.endsWith(`.${candidate}`),
  );

export const serialiseAuditEntry = (entry: Lean<AuditLogAttributes>): AuditEntryView => ({
  id: entry._id.toString(),
  actor: personRef(entry.actor),
  actorRole: entry.actorRole ?? null,
  action: entry.action,
  entityKind: entry.entityKind,
  entityId: entry.entityId ? entry.entityId.toString() : null,
  client: namedRef(entry.client, 'displayName'),
  summary: entry.summary ?? null,
  diff: entry.diff.map((change) => {
    const redacted = change.redacted === true || isRedacted(change.field);
    return {
      field: change.field,
      before: redacted ? null : (change.before ?? null),
      after: redacted ? null : (change.after ?? null),
      redacted,
    };
  }),
  ip: entry.ip ?? null,
  userAgent: entry.userAgent ?? null,
  requestId: entry.requestId ?? null,
  createdAt: timestamp(entry.createdAt),
});
