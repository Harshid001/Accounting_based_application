import { apiGet, apiList, apiPost } from '@/api/client';
import type { Paged, QueryParams } from '@/types/api';
import type { NotificationView, UnreadCounts } from '@/types/models';

export const listNotifications = (params: QueryParams): Promise<Paged<NotificationView>> =>
  apiList<NotificationView>('/notifications', { method: 'GET', query: params });

export const fetchUnreadCounts = (signal?: AbortSignal): Promise<UnreadCounts> =>
  apiGet<UnreadCounts>('/notifications/unread-count', undefined, signal);

export const markNotificationRead = (id: string): Promise<void> =>
  apiPost<void>(`/notifications/${id}/read`);

export const markAllNotificationsRead = (): Promise<{ updated: number }> =>
  apiPost<{ updated: number }>('/notifications/read-all');
