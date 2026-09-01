import { Types } from 'mongoose';
import type { z } from 'zod';

import { sendCreated, sendData, sendList } from '../lib/http.js';
import { buildPageMeta, toPageRequest } from '../lib/pagination.js';
import type { RouteContext } from '../middleware/validate.js';
import { serialiseDocumentRequest } from '../serializers/documentRequest.serializer.js';
import {
  cancelDocumentRequest,
  createDocumentRequests,
  listDocumentRequests,
  sendManualReminder,
  updateDocumentRequest,
} from '../services/documentRequest.service.js';
import type {
  CreateDocumentRequestBody,
  SingleDocumentRequest,
  documentRequestListQuery,
} from '../validators/documentRequest.validators.js';

type ListQuery = z.infer<typeof documentRequestListQuery>;

export const list = async (
  input: { query: ListQuery },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const { items, total } = await listDocumentRequests(ctx.user, input.query, page);
  sendList(ctx.res, items.map(serialiseDocumentRequest), buildPageMeta(total, page));
};

export const create = async (
  input: { body: CreateDocumentRequestBody },
  ctx: RouteContext,
): Promise<void> => {
  const items: SingleDocumentRequest[] =
    'items' in input.body ? input.body.items : [input.body];
  const created = await createDocumentRequests(ctx.clientId(), items, ctx.user, ctx.actor);
  sendCreated(ctx.res, created.map(serialiseDocumentRequest));
};

export const update = async (
  input: { params: { id: string }; body: Partial<SingleDocumentRequest> },
  ctx: RouteContext,
): Promise<void> => {
  const record = await updateDocumentRequest(
    new Types.ObjectId(input.params.id),
    input.body,
    ctx.actor,
  );
  sendData(ctx.res, serialiseDocumentRequest(record));
};

export const cancel = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  const record = await cancelDocumentRequest(new Types.ObjectId(input.params.id), ctx.actor);
  sendData(ctx.res, serialiseDocumentRequest(record));
};

export const remind = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  const result = await sendManualReminder(
    new Types.ObjectId(input.params.id),
    ctx.user,
    ctx.actor,
  );
  sendData(ctx.res, result);
};
