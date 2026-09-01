import { Types } from 'mongoose';
import type { z } from 'zod';

import { sendCreated, sendData, sendNoContent } from '../lib/http.js';
import type { RouteContext } from '../middleware/validate.js';
import { serialiseComplianceType } from '../serializers/compliance.serializer.js';
import {
  createComplianceType,
  deleteComplianceType,
  getComplianceType,
  listComplianceTypes,
  updateComplianceType,
} from '../services/complianceType.service.js';
import type {
  CreateComplianceTypeBody,
  UpdateComplianceTypeBody,
  complianceTypeListQuery,
} from '../validators/complianceType.validators.js';

type ListQuery = z.infer<typeof complianceTypeListQuery>;

export const list = async (
  input: { query: ListQuery },
  ctx: RouteContext,
): Promise<void> => {
  const items = await listComplianceTypes(input.query);
  sendData(ctx.res, items.map(serialiseComplianceType));
};

export const detail = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  const record = await getComplianceType(new Types.ObjectId(input.params.id));
  sendData(ctx.res, serialiseComplianceType(record));
};

export const create = async (
  input: { body: CreateComplianceTypeBody },
  ctx: RouteContext,
): Promise<void> => {
  const record = await createComplianceType(input.body, ctx.actor);
  sendCreated(ctx.res, serialiseComplianceType(record));
};

export const update = async (
  input: { params: { id: string }; body: UpdateComplianceTypeBody },
  ctx: RouteContext,
): Promise<void> => {
  const record = await updateComplianceType(
    new Types.ObjectId(input.params.id),
    input.body,
    ctx.actor,
  );
  sendData(ctx.res, serialiseComplianceType(record));
};

export const remove = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  await deleteComplianceType(new Types.ObjectId(input.params.id), ctx.actor);
  sendNoContent(ctx.res);
};
