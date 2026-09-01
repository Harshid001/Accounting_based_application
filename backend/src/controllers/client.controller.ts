import type { Types } from 'mongoose';

import { buildCsv, csvFilename } from '../lib/csv.js';
import { formatDateOnly } from '../lib/date.js';
import { sendCreated, sendCsv, sendData, sendList, sendNoContent } from '../lib/http.js';
import { buildPageMeta, toPageRequest } from '../lib/pagination.js';
import type { RouteContext } from '../middleware/validate.js';
import {
  serialiseClientForAdmin,
  serialiseClientForStaff,
  serialiseClientRow,
} from '../serializers/client.serializer.js';
import { serialiseAuditEntry } from '../serializers/audit.serializer.js';
import { listAudit } from '../services/audit.service.js';
import {
  allClientsInScope,
  clientHasAadhaar,
  createClient,
  getClientDetail,
  listClients,
  revealAadhaar,
  setArchived,
  setAssignments,
  setPinned,
  updateClient,
} from '../services/client.service.js';
import { recordAudit } from '../services/audit.service.js';
import type {
  ClientListQueryInput,
  CreateClientBody,
  UpdateClientBody,
} from '../validators/client.validators.js';

export const list = async (
  input: { query: ClientListQueryInput },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const { items, total, extras } = await listClients(ctx.user, input.query, page);
  sendList(
    ctx.res,
    items.map((item) => serialiseClientRow(item, extras.get(item._id.toString()))),
    buildPageMeta(total, page),
  );
};

export const detail = async (_input: unknown, ctx: RouteContext): Promise<void> => {
  const clientId = ctx.clientId();
  const record = await getClientDetail(clientId);
  if (ctx.user.role === 'admin') {
    sendData(ctx.res, serialiseClientForAdmin(record, await clientHasAadhaar(clientId)));
    return;
  }
  sendData(ctx.res, serialiseClientForStaff(record));
};

export const create = async (
  input: { body: CreateClientBody },
  ctx: RouteContext,
): Promise<void> => {
  const record = await createClient(
    {
      ...input.body,
      pan: input.body.pan === '' ? null : input.body.pan,
      gstin: input.body.gstin === '' ? null : input.body.gstin,
      tan: input.body.tan === '' ? null : input.body.tan,
      cin: input.body.cin === '' ? null : input.body.cin,
      aadhaar: input.body.aadhaar === '' ? null : input.body.aadhaar,
    },
    ctx.actor,
  );
  sendCreated(ctx.res, serialiseClientForAdmin(record, await clientHasAadhaar(record._id)));
};

export const update = async (
  input: { body: UpdateClientBody },
  ctx: RouteContext,
): Promise<void> => {
  const clientId = ctx.clientId();
  const record = await updateClient(
    clientId,
    {
      ...input.body,
      pan: input.body.pan === '' ? null : input.body.pan,
      gstin: input.body.gstin === '' ? null : input.body.gstin,
      tan: input.body.tan === '' ? null : input.body.tan,
      cin: input.body.cin === '' ? null : input.body.cin,
      aadhaar: input.body.aadhaar === '' ? null : input.body.aadhaar,
    },
    ctx.actor,
  );
  if (ctx.user.role === 'admin') {
    sendData(ctx.res, serialiseClientForAdmin(record, await clientHasAadhaar(clientId)));
    return;
  }
  sendData(ctx.res, serialiseClientForStaff(record));
};

export const archive = async (_input: unknown, ctx: RouteContext): Promise<void> => {
  const record = await setArchived(ctx.clientId(), true, ctx.actor);
  sendData(ctx.res, serialiseClientForStaff(record));
};

export const restore = async (_input: unknown, ctx: RouteContext): Promise<void> => {
  const record = await setArchived(ctx.clientId(), false, ctx.actor);
  sendData(ctx.res, serialiseClientForStaff(record));
};

export const assign = async (
  input: { body: { staffIds: string[] } },
  ctx: RouteContext,
): Promise<void> => {
  const { client, orphanedOpenItems } = await setAssignments(
    ctx.clientId(),
    input.body.staffIds,
    ctx.actor,
  );
  sendData(ctx.res, serialiseClientForStaff(client), { orphanedOpenItems });
};

export const pin = async (_input: unknown, ctx: RouteContext): Promise<void> => {
  await setPinned(ctx.user, ctx.clientId(), true);
  sendNoContent(ctx.res);
};

export const unpin = async (_input: unknown, ctx: RouteContext): Promise<void> => {
  await setPinned(ctx.user, ctx.clientId(), false);
  sendNoContent(ctx.res);
};

export const reveal = async (_input: unknown, ctx: RouteContext): Promise<void> => {
  const aadhaar = await revealAadhaar(ctx.clientId(), ctx.actor);
  sendData(ctx.res, { aadhaar });
};

export const exportCsv = async (
  input: { query: Omit<ClientListQueryInput, 'page' | 'limit'> },
  ctx: RouteContext,
): Promise<void> => {
  const rows = await allClientsInScope(ctx.user, input.query);
  const csv = buildCsv(rows, [
    { header: 'Display name', value: (row) => row.displayName },
    { header: 'Legal name', value: (row) => row.legalName ?? '' },
    { header: 'Type', value: (row) => row.clientType },
    { header: 'Status', value: (row) => row.status },
    { header: 'PAN', value: (row) => row.pan ?? '' },
    { header: 'GSTIN', value: (row) => row.gstin ?? '' },
    { header: 'TAN', value: (row) => row.tan ?? '' },
    { header: 'CIN', value: (row) => row.cin ?? '' },
    { header: 'Contact name', value: (row) => row.primaryContact.name },
    { header: 'Contact email', value: (row) => row.primaryContact.email },
    { header: 'Contact phone', value: (row) => row.primaryContact.phone ?? '' },
    { header: 'City', value: (row) => row.address?.city ?? '' },
    { header: 'State', value: (row) => row.address?.state ?? '' },
    { header: 'Pincode', value: (row) => row.address?.pincode ?? '' },
    { header: 'Created', value: (row) => formatDateOnly(row.createdAt) ?? '' },
  ]);
  await recordAudit({
    actor: ctx.actor,
    action: 'export',
    entityKind: 'client',
    summary: `Exported ${rows.length} client record${rows.length === 1 ? '' : 's'} to CSV`,
  });
  sendCsv(ctx.res, csvFilename('firmdesk-clients'), csv);
};

export const activity = async (
  input: { query: { page: number; limit: number } },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const clientId: Types.ObjectId = ctx.clientId();
  const { items, total } = await listAudit({ client: clientId.toString() }, page);
  sendList(ctx.res, items.map(serialiseAuditEntry), buildPageMeta(total, page));
};
