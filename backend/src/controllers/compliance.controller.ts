import { Types } from 'mongoose';

import { buildCsv, csvFilename } from '../lib/csv.js';
import { formatDateOnly } from '../lib/date.js';
import { sendCreated, sendCsv, sendData, sendList, sendNoContent } from '../lib/http.js';
import { buildPageMeta, toPageRequest } from '../lib/pagination.js';
import type { RouteContext } from '../middleware/validate.js';
import {
  serialiseComplianceDetail,
  serialiseComplianceRow,
} from '../serializers/compliance.serializer.js';
import { serialiseDocumentRequest } from '../serializers/documentRequest.serializer.js';
import { serialiseTaskRow } from '../serializers/task.serializer.js';
import { recordAudit } from '../services/audit.service.js';
import {
  allComplianceInScope,
  changeComplianceStatus,
  createComplianceItem,
  deleteComplianceItem,
  getComplianceItem,
  listCompliance,
  requestProgressFor,
  updateComplianceItem,
} from '../services/compliance.service.js';
import { commitPlan, planBulk } from '../services/complianceGenerator.service.js';
import { DocumentRequest } from '../models/documentRequest.model.js';
import { Task } from '../models/task.model.js';
import type { TaskAttributes } from '../models/task.model.js';
import type { DocumentRequestAttributes } from '../models/documentRequest.model.js';
import type { Lean } from '../types/lean.js';
import type {
  ComplianceStatusBody,
  CreateComplianceBody,
  GenerateBody,
  UpdateComplianceBody,
} from '../validators/compliance.validators.js';
import type { complianceListQuery } from '../validators/compliance.validators.js';
import type { z } from 'zod';

type ListQuery = z.infer<typeof complianceListQuery>;

export const list = async (
  input: { query: ListQuery },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const { items, total } = await listCompliance(ctx.user, input.query, page);
  const progress = await requestProgressFor(items.map((item) => item._id));
  sendList(
    ctx.res,
    items.map((item) => serialiseComplianceRow(item, progress.get(item._id.toString()))),
    buildPageMeta(total, page),
  );
};

export const detail = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  const id = new Types.ObjectId(input.params.id);
  const item = await getComplianceItem(id);
  const progress = await requestProgressFor([id]);
  const [requests, tasks] = await Promise.all([
    DocumentRequest.find({ complianceItem: id })
      .populate('client', 'displayName')
      .populate('requestedBy', 'name email')
      .lean<Lean<DocumentRequestAttributes>[]>()
      .exec(),
    Task.find({ complianceItem: id })
      .populate('client', 'displayName')
      .populate('assignee', 'name email role')
      .lean<Lean<TaskAttributes>[]>()
      .exec(),
  ]);
  sendData(ctx.res, {
    ...serialiseComplianceDetail(item, progress.get(id.toString())),
    requests: requests.map(serialiseDocumentRequest),
    tasks: tasks.map(serialiseTaskRow),
  });
};

export const create = async (
  input: { body: CreateComplianceBody },
  ctx: RouteContext,
): Promise<void> => {
  const item = await createComplianceItem(
    {
      clientId: ctx.clientId(),
      complianceTypeId: input.body.complianceTypeId,
      periodType: input.body.periodType,
      periodAnchor: input.body.periodAnchor,
      dueDate: input.body.dueDate,
      assignedStaff: input.body.assignedStaff,
      notes: input.body.notes,
    },
    ctx.actor,
  );
  sendCreated(ctx.res, serialiseComplianceDetail(item, { received: 0, total: 0 }));
};

export const update = async (
  input: { params: { id: string }; body: UpdateComplianceBody },
  ctx: RouteContext,
): Promise<void> => {
  const id = new Types.ObjectId(input.params.id);
  const item = await updateComplianceItem(id, input.body, ctx.actor);
  const progress = await requestProgressFor([id]);
  sendData(ctx.res, serialiseComplianceDetail(item, progress.get(id.toString())));
};

export const changeStatus = async (
  input: { params: { id: string }; body: ComplianceStatusBody },
  ctx: RouteContext,
): Promise<void> => {
  const id = new Types.ObjectId(input.params.id);
  const item = await changeComplianceStatus(id, input.body, ctx.actor);
  const progress = await requestProgressFor([id]);
  sendData(ctx.res, serialiseComplianceDetail(item, progress.get(id.toString())));
};

export const remove = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  await deleteComplianceItem(new Types.ObjectId(input.params.id), ctx.actor);
  sendNoContent(ctx.res);
};

export const preview = async (
  input: { body: GenerateBody },
  ctx: RouteContext,
): Promise<void> => {
  const plan = await planBulk(input.body);
  sendData(ctx.res, {
    willCreate: plan.willCreate.map((item) => ({
      clientId: item.clientId.toString(),
      clientName: item.clientName,
      complianceTypeName: item.complianceTypeName,
      periodLabel: item.period.periodLabel,
      dueDate: formatDateOnly(item.dueDate),
    })),
    willSkip: plan.willSkip.map((item) => ({
      clientId: item.clientId.toString(),
      clientName: item.clientName,
      complianceTypeName: item.complianceTypeName,
      periodLabel: item.periodLabel,
      reason: item.reason,
    })),
  });
};

export const generate = async (
  input: { body: GenerateBody },
  ctx: RouteContext,
): Promise<void> => {
  const plan = await planBulk(input.body);
  const result = await commitPlan(plan, 'bulk', ctx.actor);
  sendData(ctx.res, result);
};

export const exportCsv = async (
  input: { query: Omit<ListQuery, 'page' | 'limit'> },
  ctx: RouteContext,
): Promise<void> => {
  const rows = await allComplianceInScope(ctx.user, input.query);
  const progress = await requestProgressFor(rows.map((row) => row._id));
  const serialised = rows.map((row) => serialiseComplianceRow(row, progress.get(row._id.toString())));
  const csv = buildCsv(serialised, [
    { header: 'Client', value: (row) => row.client?.name ?? '' },
    { header: 'Filing', value: (row) => row.complianceType?.name ?? '' },
    { header: 'Category', value: (row) => row.complianceType?.category ?? '' },
    { header: 'Period', value: (row) => row.periodLabel },
    { header: 'Due date', value: (row) => row.dueDate ?? '' },
    { header: 'Status', value: (row) => row.status },
    { header: 'Overdue', value: (row) => (row.isOverdue ? 'Yes' : 'No') },
    { header: 'Filed date', value: (row) => row.filedDate ?? '' },
    { header: 'Assigned to', value: (row) => row.assignedStaff?.name ?? '' },
    {
      header: 'Documents received',
      value: (row) => `${row.requestProgress.received} of ${row.requestProgress.total}`,
    },
  ]);
  await recordAudit({
    actor: ctx.actor,
    action: 'export',
    entityKind: 'complianceItem',
    summary: `Exported ${rows.length} filing${rows.length === 1 ? '' : 's'} to CSV`,
  });
  sendCsv(ctx.res, csvFilename('firmdesk-compliance'), csv);
};
