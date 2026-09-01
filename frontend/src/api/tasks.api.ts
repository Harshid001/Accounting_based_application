import { apiDelete, apiGet, apiList, apiPatch, apiPost } from '@/api/client';
import type { Paged, QueryParams } from '@/types/api';
import type { TaskStatus } from '@/types/enums';
import type { TaskDetail, TaskListRow } from '@/types/models';

export const TASK_SORT_FIELDS = ['dueDate', 'priority', 'createdAt', 'status'] as const;
export type TaskSortField = (typeof TASK_SORT_FIELDS)[number];

export const listTasks = (
  params: QueryParams,
  signal?: AbortSignal,
): Promise<Paged<TaskListRow>> =>
  apiList<TaskListRow>('/tasks', {
    method: 'GET',
    query: params,
    ...(signal ? { signal } : {}),
  });

export const getTask = (id: string): Promise<TaskDetail> => apiGet<TaskDetail>(`/tasks/${id}`);

export const createTask = (body: unknown): Promise<TaskDetail> =>
  apiPost<TaskDetail>('/tasks', body);

export const updateTask = (id: string, body: unknown): Promise<TaskDetail> =>
  apiPatch<TaskDetail>(`/tasks/${id}`, body);

export const assignTask = (id: string, assigneeId: string): Promise<TaskDetail> =>
  apiPost<TaskDetail>(`/tasks/${id}/assign`, { assigneeId });

export const changeTaskStatus = (id: string, status: TaskStatus): Promise<TaskDetail> =>
  apiPost<TaskDetail>(`/tasks/${id}/status`, { status });

export const deleteTask = (id: string): Promise<void> => apiDelete<void>(`/tasks/${id}`);
