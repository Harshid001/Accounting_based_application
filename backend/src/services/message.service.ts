import type { Types } from 'mongoose';

import { notFound, validationFailed } from '../lib/errors.js';
import type { ContextRefKind } from '../lib/enums.js';
import type { PageRequest } from '../lib/pagination.js';
import { Client } from '../models/client.model.js';
import { DocumentModel } from '../models/document.model.js';
import type { MessageAttributes } from '../models/message.model.js';
import { Message } from '../models/message.model.js';
import { User } from '../models/user.model.js';
import type { AuthenticatedUser, RequestActor } from '../types/context.js';
import type { Lean } from '../types/lean.js';
import { recordAudit } from './audit.service.js';
import { accessibleClientIds } from './compliance.service.js';
import { createNotification, notifyLinkedClientUsers } from './notification.service.js';

const POPULATE = [
  { path: 'author', select: 'name email role image' },
  { path: 'attachments', select: 'title documentType currentVersion versions' },
] as const;

export const listMessages = async (
  clientId: Types.ObjectId,
  user: AuthenticatedUser,
  page: PageRequest,
): Promise<{ items: Lean<MessageAttributes>[]; total: number }> => {
  const filter = { client: clientId };
  const [items, total] = await Promise.all([
    Message.find(filter)
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate([...POPULATE])
      .lean<Lean<MessageAttributes>[]>()
      .exec(),
    Message.countDocuments(filter).exec(),
  ]);

  const unreadIds = items
    .filter((item) => !item.readBy.some((reader) => reader.equals(user.id)))
    .map((item) => item._id);
  if (unreadIds.length > 0) {
    await Message.updateMany(
      { _id: { $in: unreadIds } },
      { $addToSet: { readBy: user.id } },
    ).exec();
  }
  return { items, total };
};

export interface PostMessageInput {
  body: string;
  attachmentIds?: string[];
  contextRef?: { kind: ContextRefKind; id: string } | null;
}

export const postMessage = async (
  clientId: Types.ObjectId,
  input: PostMessageInput,
  user: AuthenticatedUser,
  actor: RequestActor,
): Promise<Lean<MessageAttributes>> => {
  const attachmentIds = input.attachmentIds ?? [];
  if (attachmentIds.length > 0) {
    const count = await DocumentModel.countDocuments({
      _id: { $in: attachmentIds },
      client: clientId,
    }).exec();
    if (count !== new Set(attachmentIds).size) {
      throw validationFailed('Every attachment must belong to this client.', [
        { field: 'attachmentIds', message: 'One of these documents belongs to another client.' },
      ]);
    }
  }

  const created = await Message.create({
    client: clientId,
    author: user.id,
    authorRole: user.role,
    body: input.body,
    attachments: attachmentIds,
    contextRef: input.contextRef ?? null,
    readBy: [user.id],
  });

  await recordAudit({
    actor,
    action: 'create',
    entityKind: 'message',
    entityId: created._id,
    client: clientId,
    summary: 'Posted a message on the client thread',
  });

  const client = await Client.findById(clientId).select('displayName assignedStaff').lean().exec();
  const preview = input.body.slice(0, 160);

  if (user.role === 'client') {
    for (const staffId of client?.assignedStaff ?? []) {
      await createNotification({
        recipient: staffId,
        type: 'new_message',
        title: `New message from ${client?.displayName ?? 'a client'}`,
        body: preview,
        link: `/clients/${clientId.toString()}/messages`,
        entity: { kind: 'message', id: created._id },
      });
    }
    const admins = await User.find({ role: 'admin', status: 'active' }).select('_id').lean().exec();
    for (const admin of admins) {
      await createNotification({
        recipient: admin._id,
        type: 'new_message',
        title: `New message from ${client?.displayName ?? 'a client'}`,
        body: preview,
        link: `/clients/${clientId.toString()}/messages`,
        entity: { kind: 'message', id: created._id },
      });
    }
  } else {
    await notifyLinkedClientUsers(clientId, {
      type: 'new_message',
      title: 'New message from your firm',
      body: preview,
      link: '/portal/messages',
      entity: { kind: 'message', id: created._id },
    });
  }

  const record = await Message.findById(created._id)
    .populate([...POPULATE])
    .lean<Lean<MessageAttributes> | null>()
    .exec();
  if (!record) throw notFound('message');
  return record;
};

export interface ThreadSummary {
  clientId: string;
  clientName: string;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  unreadCount: number;
}

export const listThreads = async (user: AuthenticatedUser): Promise<ThreadSummary[]> => {
  const scoped = await accessibleClientIds(user);
  const clientFilter = scoped === null ? { archived: false } : { _id: { $in: scoped }, archived: false };
  const clients = await Client.find(clientFilter).select('displayName').lean().exec();
  if (clients.length === 0) return [];

  const clientIds = clients.map((client) => client._id);
  const [latest, unread] = await Promise.all([
    Message.aggregate<{ _id: Types.ObjectId; createdAt: Date; body: string }>([
      { $match: { client: { $in: clientIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$client',
          createdAt: { $first: '$createdAt' },
          body: { $first: '$body' },
        },
      },
    ]).exec(),
    Message.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          client: { $in: clientIds },
          readBy: { $ne: user.id },
          author: { $ne: user.id },
        },
      },
      { $group: { _id: '$client', count: { $sum: 1 } } },
    ]).exec(),
  ]);

  const latestMap = new Map(latest.map((row) => [row._id.toString(), row]));
  const unreadMap = new Map(unread.map((row) => [row._id.toString(), row.count]));

  return clients
    .map((client) => {
      const key = client._id.toString();
      const last = latestMap.get(key);
      return {
        clientId: key,
        clientName: client.displayName,
        lastMessageAt: last?.createdAt ?? null,
        lastMessagePreview: last ? last.body.slice(0, 160) : null,
        unreadCount: unreadMap.get(key) ?? 0,
      };
    })
    .sort((a, b) => {
      if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
      return (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0);
    });
};
