import type { NotificationAttributes } from '../models/notification.model.js';
import type { Lean } from '../types/lean.js';
import { timestamp } from './common.js';

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string;
  read: boolean;
  readAt: string | null;
  createdAt: string | null;
}

export const serialiseNotification = (
  notification: Lean<NotificationAttributes>,
): NotificationView => ({
  id: notification._id.toString(),
  type: notification.type,
  title: notification.title,
  body: notification.body ?? null,
  link: notification.link,
  read: notification.read,
  readAt: timestamp(notification.readAt),
  createdAt: timestamp(notification.createdAt),
});
