import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

import { AUDIT_ACTIONS, AUDIT_ENTITY_KINDS, ROLES } from '../lib/enums.js';
import type { AuditAction, AuditEntityKind, Role } from '../lib/enums.js';

export interface AuditDiffEntry {
  field: string;
  before?: unknown;
  after?: unknown;
  redacted?: boolean;
}

export interface AuditLogAttributes {
  actor?: Types.ObjectId | null;
  actorRole?: Role | 'system' | null;
  action: AuditAction;
  entityKind: AuditEntityKind;
  entityId?: Types.ObjectId | null;
  client?: Types.ObjectId | null;
  summary?: string | null;
  diff: AuditDiffEntry[];
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AuditLogDocument = HydratedDocument<AuditLogAttributes>;

const diffSchema = new Schema<AuditDiffEntry>(
  {
    field: { type: String, required: true, maxlength: 120 },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    redacted: { type: Boolean, default: false },
  },
  { _id: false },
);

const auditLogSchema = new Schema<AuditLogAttributes>(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'user', default: null },
    actorRole: { type: String, enum: [...ROLES, 'system', null], default: null },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    entityKind: { type: String, enum: AUDIT_ENTITY_KINDS, required: true },
    entityId: { type: Schema.Types.ObjectId, default: null },
    client: { type: Schema.Types.ObjectId, ref: 'client', default: null },
    summary: { type: String, default: null, maxlength: 400 },
    diff: { type: [diffSchema], default: [] },
    ip: { type: String, default: null, maxlength: 60 },
    userAgent: { type: String, default: null, maxlength: 400 },
    requestId: { type: String, default: null, maxlength: 80 },
  },
  { timestamps: true, collection: 'auditLog' },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityKind: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ client: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog: Model<AuditLogAttributes> = model<AuditLogAttributes>(
  'auditLog',
  auditLogSchema,
);
