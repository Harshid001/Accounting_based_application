import { Types } from 'mongoose';

import { sendCreated, sendData, sendNoContent } from '../lib/http.js';
import type { RouteContext } from '../middleware/validate.js';
import { serialiseClientService } from '../serializers/compliance.serializer.js';
import {
  createClientService,
  deleteClientService,
  listClientServices,
  updateClientService,
} from '../services/clientService.service.js';
import type {
  CreateClientServiceBody,
  UpdateClientServiceBody,
} from '../validators/clientService.validators.js';

export const list = async (_input: unknown, ctx: RouteContext): Promise<void> => {
  const items = await listClientServices(ctx.clientId());
  sendData(ctx.res, items.map(serialiseClientService));
};

export const create = async (
  input: { body: CreateClientServiceBody },
  ctx: RouteContext,
): Promise<void> => {
  const record = await createClientService(ctx.clientId(), input.body, ctx.actor);
  sendCreated(ctx.res, serialiseClientService(record));
};

export const update = async (
  input: { params: { id: string }; body: UpdateClientServiceBody },
  ctx: RouteContext,
): Promise<void> => {
  const record = await updateClientService(
    new Types.ObjectId(input.params.id),
    input.body,
    ctx.actor,
  );
  sendData(ctx.res, serialiseClientService(record));
};

export const remove = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  await deleteClientService(new Types.ObjectId(input.params.id), ctx.actor);
  sendNoContent(ctx.res);
};
