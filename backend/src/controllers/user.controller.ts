import { Types } from 'mongoose';
import type { z } from 'zod';

import { sendData, sendList } from '../lib/http.js';
import { buildPageMeta, toPageRequest } from '../lib/pagination.js';
import type { RouteContext } from '../middleware/validate.js';
import { serialiseStaffOption, serialiseUserForAdmin } from '../serializers/user.serializer.js';
import {
  adminUpdateUser,
  changeRole,
  getUser,
  listUsers,
  purgeUnlinkedAccounts,
  setLinkedClients,
  setUserStatus,
} from '../services/user.service.js';
import type {
  adminUpdateUserBody,
  linkedClientsBody,
  purgeUnlinkedBody,
  roleBody,
  userListQuery,
} from '../validators/user.validators.js';

type ListQuery = z.infer<typeof userListQuery>;

export const list = async (
  input: { query: ListQuery },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const { items, total } = await listUsers(input.query, page);
  sendList(ctx.res, items.map(serialiseUserForAdmin), buildPageMeta(total, page));
};

export const staffOptions = async (
  input: { query: { page: number; limit: number } },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const { items, total } = await listUsers({ status: 'active' }, page);
  sendList(
    ctx.res,
    items.filter((user) => user.role !== 'client').map(serialiseStaffOption),
    buildPageMeta(total, page),
  );
};

export const detail = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  const record = await getUser(new Types.ObjectId(input.params.id));
  sendData(ctx.res, serialiseUserForAdmin(record));
};

export const update = async (
  input: { params: { id: string }; body: z.infer<typeof adminUpdateUserBody> },
  ctx: RouteContext,
): Promise<void> => {
  const record = await adminUpdateUser(
    new Types.ObjectId(input.params.id),
    input.body,
    ctx.actor,
  );
  sendData(ctx.res, serialiseUserForAdmin(record));
};

export const setRole = async (
  input: { params: { id: string }; body: z.infer<typeof roleBody> },
  ctx: RouteContext,
): Promise<void> => {
  const record = await changeRole(
    new Types.ObjectId(input.params.id),
    input.body.role,
    ctx.actor,
  );
  sendData(ctx.res, serialiseUserForAdmin(record));
};

export const setLinks = async (
  input: { params: { id: string }; body: z.infer<typeof linkedClientsBody> },
  ctx: RouteContext,
): Promise<void> => {
  const record = await setLinkedClients(
    new Types.ObjectId(input.params.id),
    input.body.clientIds,
    ctx.actor,
  );
  sendData(ctx.res, serialiseUserForAdmin(record));
};

export const deactivate = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  const record = await setUserStatus(
    new Types.ObjectId(input.params.id),
    'deactivated',
    ctx.actor,
  );
  sendData(ctx.res, serialiseUserForAdmin(record));
};

export const activate = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  const record = await setUserStatus(new Types.ObjectId(input.params.id), 'active', ctx.actor);
  sendData(ctx.res, serialiseUserForAdmin(record));
};

export const purgeUnlinked = async (
  input: { body: z.infer<typeof purgeUnlinkedBody> },
  ctx: RouteContext,
): Promise<void> => {
  const deleted = await purgeUnlinkedAccounts(input.body.olderThanDays, ctx.actor);
  sendData(ctx.res, { deleted });
};
