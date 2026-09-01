import { Types } from 'mongoose';

import { sendCreated, sendData, sendList, sendNoContent } from '../lib/http.js';
import { buildPageMeta, toPageRequest } from '../lib/pagination.js';
import type { RouteContext } from '../middleware/validate.js';
import { serialiseTaskComment } from '../serializers/task.serializer.js';
import {
  createTaskComment,
  deleteTaskComment,
  listTaskComments,
  updateTaskComment,
} from '../services/taskComment.service.js';

export const list = async (
  input: { params: { id: string }; query: { page: number; limit: number } },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const { items, total } = await listTaskComments(new Types.ObjectId(input.params.id), page);
  sendList(ctx.res, items.map(serialiseTaskComment), buildPageMeta(total, page));
};

export const create = async (
  input: { params: { id: string }; body: { body: string } },
  ctx: RouteContext,
): Promise<void> => {
  const comment = await createTaskComment(
    new Types.ObjectId(input.params.id),
    input.body.body,
    ctx.user,
    ctx.actor,
  );
  sendCreated(ctx.res, serialiseTaskComment(comment));
};

export const update = async (
  input: { params: { id: string }; body: { body: string } },
  ctx: RouteContext,
): Promise<void> => {
  const comment = await updateTaskComment(
    new Types.ObjectId(input.params.id),
    input.body.body,
    ctx.user,
    ctx.actor,
  );
  sendData(ctx.res, serialiseTaskComment(comment));
};

export const remove = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  await deleteTaskComment(new Types.ObjectId(input.params.id), ctx.user, ctx.actor);
  sendNoContent(ctx.res);
};
