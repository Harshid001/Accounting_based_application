import type { Types } from 'mongoose';

import { logger } from '../config/logger.js';
import type { NotificationType } from '../lib/enums.js';
import type { PageRequest } from '../lib/pagination.js';
import type { NotificationAttributes } from '../models/notification.model.js';
import type { Lean } from '../types/lean.js';
import { Notification } from '../models/notification.model.js';
import { Message } from '../models/message.model.js';
import { User } from '../models/user.model.js';
import type { AuthenticatedUser } from '../types/context.js';

export interface CreateNotificationInput {
  recipient: Types.ObjectId;
  type: NotificationType;
  title: string;
  body?: string | null;
  link: string;
  entity?: { kind: string; id: Types.ObjectId } | null;
  dedupeKey?: string | null;
}

export const createNotification = async (input: CreateNotificationInput): Promise<void> => {
  try {
    await Notification.create({
      recipient: input.recipient,
      type: input.type,
      title: input.title.slice(0, 200),
      body: input.body?.slice(0, 1000) ?? null,
      link: input.link,
      entity: input.entity ?? null,
      dedupeKey: input.dedupeKey ?? null,
      read: false,
    });
  } catch (error) {
    if (error !== null && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return;
    }
    logger.error({ event: 'notification.failed', err: error }, 'notification could not be stored');
  }
};

export const createNotifications = async (
  inputs: readonly CreateNotificationInput[],
): Promise<void> => {
  for (const input of inputs) {
    await createNotification(input);
  }
};

export const notifyLinkedClientUsers = async (
  clientId: Types.ObjectId,
  input: Omit<CreateNotificationInput, 'recipient'>,
): Promise<void> => {
  const recipients = await User.find({ role: 'client', linkedClients: clientId, status: 'active' })
    .select('_id')
    .lean()
    .exec();
  await createNotifications(
    recipients.map((recipient) => ({
      ...input,
      recipient: recipient._id,
      dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${recipient._id.toString()}` : null,
    })),
  );
};

export const listNotifications = async (
  user: AuthenticatedUser,
  page: PageRequest,
  onlyUnread: boolean,
): Promise<{ items: Lean<NotificationAttributes>[]; total: number }> => {
  const filter = { recipient: user.id, ...(onlyUnread ? { read: false } : {}) };
  const [items, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .lean<Lean<NotificationAttributes>[]>()
      .exec(),
    Notification.countDocuments(filter).exec(),
  ]);
  return { items, total };
};

export const unreadCounts = async (
  user: AuthenticatedUser,
): Promise<{ notifications: number; messages: number }> => {
  const messageFilter =
    user.role === 'client'
      ? { client: { $in: user.linkedClients }, readBy: { $ne: user.id }, author: { $ne: user.id } }
      : { readBy: { $ne: user.id }, author: { $ne: user.id } };

  const [notifications, messages] = await Promise.all([
    Notification.countDocuments({ recipient: user.id, read: false }).exec(),
    user.role === 'staff'
      ? countStaffUnreadMessages(user)
      : Message.countDocuments(messageFilter).exec(),
  ]);
  return { notifications, messages };
};

const countStaffUnreadMessages = async (user: AuthenticatedUser): Promise<number> => {
  const { Client } = await import('../models/client.model.js');
  const clients = await Client.find({ assignedStaff: user.id, archived: false })
    .select('_id')
    .lean()
    .exec();
  if (clients.length === 0) return 0;
  return Message.countDocuments({
    client: { $in: clients.map((client) => client._id) },
    readBy: { $ne: user.id },
    author: { $ne: user.id },
  }).exec();
};

export const markNotificationRead = async (
  user: AuthenticatedUser,
  notificationId: Types.ObjectId,
): Promise<boolean> => {
  const result = await Notification.updateOne(
    { _id: notificationId, recipient: user.id, read: false },
    { $set: { read: true, readAt: new Date() } },
  ).exec();
  return result.matchedCount > 0;
};

export const markAllNotificationsRead = async (user: AuthenticatedUser): Promise<number> => {
  const result = await Notification.updateMany(
    { recipient: user.id, read: false },
    { $set: { read: true, readAt: new Date() } },
  ).exec();
  return result.modifiedCount;
};
