import { apiDelete, apiList, apiPatch, apiPost } from '@/api/client';
import type { Paged, QueryParams } from '@/types/api';
import type { TaskComment } from '@/types/models';

export const listTaskComments = (
  taskId: string,
  params: QueryParams,
): Promise<Paged<TaskComment>> =>
  apiList<TaskComment>(`/tasks/${taskId}/comments`, { method: 'GET', query: params });

export const createTaskComment = (taskId: string, body: string): Promise<TaskComment> =>
  apiPost<TaskComment>(`/tasks/${taskId}/comments`, { body });

export const updateTaskComment = (commentId: string, body: string): Promise<TaskComment> =>
  apiPatch<TaskComment>(`/task-comments/${commentId}`, { body });

export const deleteTaskComment = (commentId: string): Promise<void> =>
  apiDelete<void>(`/task-comments/${commentId}`);
