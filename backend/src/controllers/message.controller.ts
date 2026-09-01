import { sendCreated, sendData, sendList } from '../lib/http.js';
import { buildPageMeta, toPageRequest } from '../lib/pagination.js';
import type { RouteContext } from '../middleware/validate.js';
import { serialiseMessage, serialiseThread } from '../serializers/message.serializer.js';
import { listMessages, listThreads, postMessage } from '../services/message.service.js';
import type { PostMessageBody } from '../validators/message.validators.js';

export const list = async (
  input: { query: { page: number; limit: number } },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const { items, total } = await listMessages(ctx.clientId(), ctx.user, page);
  const viewerId = ctx.user.id.toString();
  sendList(
    ctx.res,
    items.map((item) => serialiseMessage(item, viewerId)),
    buildPageMeta(total, page),
  );
};

export const create = async (
  input: { body: PostMessageBody },
  ctx: RouteContext,
): Promise<void> => {
  const message = await postMessage(ctx.clientId(), input.body, ctx.user, ctx.actor);
  sendCreated(ctx.res, serialiseMessage(message, ctx.user.id.toString()));
};

export const threads = async (_input: unknown, ctx: RouteContext): Promise<void> => {
  const items = await listThreads(ctx.user);
  sendData(ctx.res, items.map(serialiseThread));
};
