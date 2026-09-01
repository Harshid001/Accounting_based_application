import type { QueryFilter, Types } from 'mongoose';

import { formatDisplayDate, todayIST } from '../lib/date.js';
import type { DocumentRequestStatus, DocumentType } from '../lib/enums.js';
import { conflict, notFound } from '../lib/errors.js';
import type { PageRequest } from '../lib/pagination.js';
import { appLink, sendMail } from '../email/send.js';
import { renderClientRequestReminder } from '../email/templates/clientRequestReminder.js';
import { Client } from '../models/client.model.js';
import type { DocumentRequestAttributes } from '../models/documentRequest.model.js';
import { DocumentRequest } from '../models/documentRequest.model.js';
import { User } from '../models/user.model.js';
import type { AuthenticatedUser, RequestActor } from '../types/context.js';
import type { Lean } from '../types/lean.js';
import { recordAudit } from './audit.service.js';
import { accessibleClientIds } from './compliance.service.js';
import { createNotification } from './notification.service.js';
import { firmName } from './settings.service.js';

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_REMINDERS_PER_WINDOW = 3;

export interface DocumentRequestListQuery {
  client?: string;
  status?: DocumentRequestStatus;
  complianceItem?: string;
  overdue?: boolean;
  dueFrom?: Date;
  dueTo?: Date;
}

export const buildRequestFilter = async (
  user: AuthenticatedUser,
  query: DocumentRequestListQuery,
): Promise<QueryFilter<DocumentRequestAttributes>> => {
  const filter: QueryFilter<DocumentRequestAttributes> = {};
  const scoped = await accessibleClientIds(user);
  if (query.client) {
    if (scoped !== null && !scoped.some((id) => id.toString() === query.client)) {
      throw notFound('client');
    }
    filter.client = query.client;
  } else if (scoped !== null) {
    filter.client = { $in: scoped };
  }
  if (query.status) filter.status = query.status;
  if (query.complianceItem) filter.complianceItem = query.complianceItem;
  if (query.dueFrom || query.dueTo) {
    filter.dueDate = {
      ...(query.dueFrom ? { $gte: query.dueFrom } : {}),
      ...(query.dueTo ? { $lte: query.dueTo } : {}),
    };
  }
  if (query.overdue === true) {
    filter.status = 'open';
    filter.dueDate = { ...(filter.dueDate as object), $lt: todayIST() };
  }
  return filter;
};

const POPULATE = [
  { path: 'client', select: 'displayName' },
  { path: 'complianceItem', select: 'periodLabel dueDate status' },
  { path: 'requestedBy', select: 'name email' },
] as const;

export const listDocumentRequests = async (
  user: AuthenticatedUser,
  query: DocumentRequestListQuery,
  page: PageRequest,
): Promise<{ items: Lean<DocumentRequestAttributes>[]; total: number }> => {
  const filter = await buildRequestFilter(user, query);
  const [items, total] = await Promise.all([
    DocumentRequest.find(filter)
      .sort({ status: 1, dueDate: 1, createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate([...POPULATE])
      .lean<Lean<DocumentRequestAttributes>[]>()
      .exec(),
    DocumentRequest.countDocuments(filter).exec(),
  ]);
  return { items, total };
};

export const getDocumentRequest = async (
  id: Types.ObjectId,
): Promise<Lean<DocumentRequestAttributes>> => {
  const record = await DocumentRequest.findById(id)
    .populate([...POPULATE])
    .lean<Lean<DocumentRequestAttributes> | null>()
    .exec();
  if (!record) throw notFound('document request');
  return record;
};

export const clientIdOfRequest = async (id: Types.ObjectId): Promise<Types.ObjectId> => {
  const record = await DocumentRequest.findById(id).select('client').lean().exec();
  if (!record) throw notFound('document request');
  return record.client;
};

export interface DocumentRequestWrite {
  title: string;
  description?: string | null;
  documentType: DocumentType;
  dueDate?: Date | null;
  complianceItemId?: string | null;
}

export const createDocumentRequests = async (
  clientId: Types.ObjectId,
  items: readonly DocumentRequestWrite[],
  user: AuthenticatedUser,
  actor: RequestActor,
): Promise<Lean<DocumentRequestAttributes>[]> => {
  const created = await DocumentRequest.insertMany(
    items.map((item) => ({
      client: clientId,
      complianceItem: item.complianceItemId ?? null,
      title: item.title,
      description: item.description ?? null,
      documentType: item.documentType,
      dueDate: item.dueDate ?? null,
      status: 'open' as const,
      requestedBy: user.id,
      createdBy: user.id,
      updatedBy: user.id,
    })),
  );

  await recordAudit({
    actor,
    action: 'create',
    entityKind: 'documentRequest',
    client: clientId,
    summary: `Raised ${created.length} document request${created.length === 1 ? '' : 's'}`,
  });

  const detailed: Lean<DocumentRequestAttributes>[] = [];
  for (const record of created) {
    detailed.push(await getDocumentRequest(record._id));
  }
  return detailed;
};

export const updateDocumentRequest = async (
  id: Types.ObjectId,
  patch: Partial<DocumentRequestWrite>,
  actor: RequestActor,
): Promise<Lean<DocumentRequestAttributes>> => {
  const doc = await DocumentRequest.findById(id).exec();
  if (!doc) throw notFound('document request');
  if (doc.status !== 'open') {
    throw conflict('Only an open request can be edited.');
  }
  if (patch.title !== undefined) doc.title = patch.title;
  if (patch.description !== undefined) doc.description = patch.description;
  if (patch.documentType !== undefined) doc.documentType = patch.documentType;
  if (patch.dueDate !== undefined) doc.dueDate = patch.dueDate;
  if (patch.complianceItemId !== undefined) doc.set('complianceItem', patch.complianceItemId);
  doc.set('updatedBy', actor.id);
  await doc.save();
  await recordAudit({
    actor,
    action: 'update',
    entityKind: 'documentRequest',
    entityId: doc._id,
    client: doc.client,
    summary: `Updated document request ${doc.title}`,
  });
  return getDocumentRequest(id);
};

export const cancelDocumentRequest = async (
  id: Types.ObjectId,
  actor: RequestActor,
): Promise<Lean<DocumentRequestAttributes>> => {
  const doc = await DocumentRequest.findById(id).exec();
  if (!doc) throw notFound('document request');
  if (doc.status !== 'open') {
    throw conflict('Only an open request can be cancelled.');
  }
  doc.status = 'cancelled';
  doc.set('updatedBy', actor.id);
  await doc.save();
  await recordAudit({
    actor,
    action: 'status_change',
    entityKind: 'documentRequest',
    entityId: doc._id,
    client: doc.client,
    summary: `Cancelled document request ${doc.title}`,
  });
  return getDocumentRequest(id);
};

export const fulfilDocumentRequest = async (
  requestId: Types.ObjectId,
  documentId: Types.ObjectId,
  actor: RequestActor,
): Promise<void> => {
  const doc = await DocumentRequest.findById(requestId).exec();
  if (!doc) throw notFound('document request');
  if (doc.status !== 'open') return;
  doc.status = 'fulfilled';
  doc.fulfilledBy = documentId;
  doc.fulfilledAt = new Date();
  await doc.save();

  await recordAudit({
    actor,
    action: 'status_change',
    entityKind: 'documentRequest',
    entityId: doc._id,
    client: doc.client,
    summary: `Document request ${doc.title} was fulfilled`,
  });

  if (doc.requestedBy) {
    await createNotification({
      recipient: doc.requestedBy,
      type: 'request_fulfilled',
      title: doc.title,
      body: 'The client uploaded the document you asked for.',
      link: `/clients/${doc.client.toString()}/requests`,
      entity: { kind: 'documentRequest', id: doc._id },
    });
  }
};

export const sendManualReminder = async (
  id: Types.ObjectId,
  user: AuthenticatedUser,
  actor: RequestActor,
): Promise<{ sent: number }> => {
  const doc = await DocumentRequest.findById(id).exec();
  if (!doc) throw notFound('document request');
  if (doc.status !== 'open') {
    throw conflict('This request is already closed, so there is nothing to chase.');
  }
  const withinWindow =
    doc.lastRemindedAt !== null &&
    doc.lastRemindedAt !== undefined &&
    Date.now() - doc.lastRemindedAt.getTime() < REMINDER_WINDOW_MS;
  if (withinWindow && doc.reminderCount >= MAX_REMINDERS_PER_WINDOW) {
    throw conflict('This request has already been chased three times today.');
  }

  const [client, recipients, name] = await Promise.all([
    Client.findById(doc.client).select('displayName').lean().exec(),
    User.find({ role: 'client', linkedClients: doc.client, status: 'active' })
      .select('name email notificationPreferences')
      .lean()
      .exec(),
    firmName(),
  ]);
  if (!client) throw notFound('client');

  let sent = 0;
  for (const recipient of recipients) {
    const delivered = await sendMail({
      to: recipient.email,
      category: 'client_reminder',
      rendered: renderClientRequestReminder({
        firmName: name,
        recipientName: recipient.name,
        clientName: client.displayName,
        requestTitle: doc.title,
        requestDescription: doc.description ?? null,
        dueDate: doc.dueDate ? formatDisplayDate(doc.dueDate) : null,
        senderName: user.name,
        portalUrl: appLink('/portal/requests'),
      }),
    });
    if (delivered) sent += 1;
  }

  doc.lastRemindedAt = new Date();
  doc.reminderCount = withinWindow ? doc.reminderCount + 1 : 1;
  await doc.save();

  await recordAudit({
    actor,
    action: 'send_client_email',
    entityKind: 'documentRequest',
    entityId: doc._id,
    client: doc.client,
    summary: `Sent a reminder for ${doc.title} to ${sent} contact${sent === 1 ? '' : 's'}`,
  });
  return { sent };
};
