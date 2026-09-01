import { Types } from 'mongoose';
import type { z } from 'zod';

import { sendCreated, sendData, sendList, sendNoContent } from '../lib/http.js';
import { buildPageMeta, toPageRequest } from '../lib/pagination.js';
import type { RouteContext } from '../middleware/validate.js';
import { serialiseTaskDetail, serialiseTaskRow } from '../serializers/task.serializer.js';
import {
  assignTask,
  blockingReasons,
  changeTaskStatus,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} from '../services/task.service.js';
import { listMyWork } from '../services/myWork.service.js';
import { formatDateOnly } from '../lib/date.js';
import type {
  CreateTaskBody,
  UpdateTaskBody,
  taskListQuery,
} from '../validators/task.validators.js';

type ListQuery = z.infer<typeof taskListQuery>;

export const list = async (
  input: { query: ListQuery },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const { items, total } = await listTasks(ctx.user, input.query, page);
  sendList(ctx.res, items.map(serialiseTaskRow), buildPageMeta(total, page));
};

export const detail = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  const id = new Types.ObjectId(input.params.id);
  const [task, blockers] = await Promise.all([getTask(id), blockingReasons(id)]);
  sendData(ctx.res, { ...serialiseTaskDetail(task), blockedByOpen: blockers });
};

export const create = async (
  input: { body: CreateTaskBody },
  ctx: RouteContext,
): Promise<void> => {
  const task = await createTask(input.body, ctx.user, ctx.actor);
  sendCreated(ctx.res, serialiseTaskDetail(task));
};

export const update = async (
  input: { params: { id: string }; body: UpdateTaskBody },
  ctx: RouteContext,
): Promise<void> => {
  const task = await updateTask(
    new Types.ObjectId(input.params.id),
    input.body,
    ctx.user,
    ctx.actor,
  );
  sendData(ctx.res, serialiseTaskDetail(task));
};

export const assign = async (
  input: { params: { id: string }; body: { assigneeId: string } },
  ctx: RouteContext,
): Promise<void> => {
  const task = await assignTask(
    new Types.ObjectId(input.params.id),
    input.body.assigneeId,
    ctx.user,
    ctx.actor,
  );
  sendData(ctx.res, serialiseTaskDetail(task));
};

export const changeStatus = async (
  input: { params: { id: string }; body: { status: CreateTaskBody['status'] } },
  ctx: RouteContext,
): Promise<void> => {
  const status = input.body.status ?? 'not_started';
  const task = await changeTaskStatus(new Types.ObjectId(input.params.id), status, ctx.actor);
  sendData(ctx.res, serialiseTaskDetail(task));
};

export const remove = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  await deleteTask(new Types.ObjectId(input.params.id), ctx.actor);
  sendNoContent(ctx.res);
};

export const myWork = async (
  input: { query: { page: number; limit: number } },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const { items, total } = await listMyWork(ctx.user, page);
  sendList(
    ctx.res,
    items.map((item) => ({ ...item, dueDate: formatDateOnly(item.dueDate) })),
    buildPageMeta(total, page),
  );
};
