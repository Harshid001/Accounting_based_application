import { Types } from 'mongoose';

import { notFound } from '../lib/errors.js';
import { sendData, sendList, sendNoContent } from '../lib/http.js';
import { buildPageMeta, toPageRequest } from '../lib/pagination.js';
import type { RouteContext } from '../middleware/validate.js';
import { serialiseNotification } from '../serializers/notification.serializer.js';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadCounts,
} from '../services/notification.service.js';

export const list = async (
  input: { query: { page: number; limit: number; unread?: boolean } },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const { items, total } = await listNotifications(ctx.user, page, input.query.unread === true);
  sendList(ctx.res, items.map(serialiseNotification), buildPageMeta(total, page));
};

export const unreadCount = async (_input: unknown, ctx: RouteContext): Promise<void> => {
  sendData(ctx.res, await unreadCounts(ctx.user));
};

export const markRead = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  const changed = await markNotificationRead(ctx.user, new Types.ObjectId(input.params.id));
  if (!changed) throw notFound('notification');
  sendNoContent(ctx.res);
};

export const markAllRead = async (_input: unknown, ctx: RouteContext): Promise<void> => {
  const updated = await markAllNotificationsRead(ctx.user);
  sendData(ctx.res, { updated });
};
