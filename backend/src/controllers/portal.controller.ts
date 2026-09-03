import type { Types } from 'mongoose';
import type { z } from 'zod';

import { addDays, todayIST } from '../lib/date.js';
import { CLOSED_COMPLIANCE_STATUSES } from '../lib/enums.js';
import { forbidden, notFound } from '../lib/errors.js';
import { sendData, sendList } from '../lib/http.js';
import { buildPageMeta, toPageRequest } from '../lib/pagination.js';
import type { RouteContext } from '../middleware/validate.js';
import { Client } from '../models/client.model.js';
import { ComplianceItem } from '../models/complianceItem.model.js';
import type { ComplianceItemAttributes } from '../models/complianceItem.model.js';
import { DocumentRequest } from '../models/documentRequest.model.js';
import type { DocumentRequestAttributes } from '../models/documentRequest.model.js';
import { Message } from '../models/message.model.js';
import { Task } from '../models/task.model.js';
import type { TaskAttributes } from '../models/task.model.js';
import type { ClientAttributes } from '../models/client.model.js';
import {
  serialiseClientForPortal,
  serialisePortalClientOption,
} from '../serializers/client.serializer.js';
import { serialiseComplianceForPortal } from '../serializers/compliance.serializer.js';
import { serialiseDocumentRequestForPortal } from '../serializers/documentRequest.serializer.js';
import { serialiseTaskForPortal } from '../serializers/task.serializer.js';
import { clientHasAadhaar, revealAadhaar, submitClientOnboarding, updateClient } from '../services/client.service.js';
import type { Lean } from '../types/lean.js';
import type { portalOnboardingBody, portalProfileBody } from '../validators/client.validators.js';
import type { portalComplianceQuery } from '../validators/compliance.validators.js';

type ComplianceQuery = z.infer<typeof portalComplianceQuery>;
type ProfileBody = z.infer<typeof portalProfileBody>;
type OnboardingBody = z.infer<typeof portalOnboardingBody>;


export const listLinkedClients = async (_input: unknown, ctx: RouteContext): Promise<void> => {
  const clients = await Client.find({ _id: { $in: ctx.user.linkedClients } })
    .sort({ displayName: 1 })
    .select('displayName')
    .lean<Lean<ClientAttributes>[]>()
    .exec();
  sendData(ctx.res, clients.map(serialisePortalClientOption));
};

export const overview = async (_input: unknown, ctx: RouteContext): Promise<void> => {
  const clientId = ctx.clientId();
  const today = todayIST();
  const open = { client: clientId, status: { $nin: CLOSED_COMPLIANCE_STATUSES } };

  const [dueSoon, overdue, awaitingYou, openRequests, unreadMessages, upcoming] =
    await Promise.all([
      ComplianceItem.countDocuments({
        ...open,
        dueDate: { $gte: today, $lte: addDays(today, 30) },
      }).exec(),
      ComplianceItem.countDocuments({ ...open, dueDate: { $lt: today } }).exec(),
      ComplianceItem.countDocuments({ client: clientId, status: 'awaiting_client' }).exec(),
      DocumentRequest.countDocuments({ client: clientId, status: 'open' }).exec(),
      Message.countDocuments({
        client: clientId,
        readBy: { $ne: ctx.user.id },
        author: { $ne: ctx.user.id },
      }).exec(),
      ComplianceItem.find(open)
        .sort({ dueDate: 1 })
        .limit(5)
        .populate('complianceType', 'name')
        .lean<Lean<ComplianceItemAttributes>[]>()
        .exec(),
    ]);

  sendData(ctx.res, {
    dueSoon,
    overdue,
    awaitingYou,
    openRequests,
    unreadMessages,
    upcoming: upcoming.map(serialiseComplianceForPortal),
  });
};

export const compliance = async (
  input: { query: ComplianceQuery },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const filter: Record<string, unknown> = { client: ctx.clientId() };
  if (input.query.status) filter.status = input.query.status;
  if (input.query.dueFrom || input.query.dueTo) {
    filter.dueDate = {
      ...(input.query.dueFrom ? { $gte: input.query.dueFrom } : {}),
      ...(input.query.dueTo ? { $lte: input.query.dueTo } : {}),
    };
  }
  const [items, total] = await Promise.all([
    ComplianceItem.find(filter)
      .sort({ dueDate: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate('complianceType', 'name')
      .lean<Lean<ComplianceItemAttributes>[]>()
      .exec(),
    ComplianceItem.countDocuments(filter).exec(),
  ]);
  sendList(ctx.res, items.map(serialiseComplianceForPortal), buildPageMeta(total, page));
};

export const tasks = async (
  input: { query: { page: number; limit: number } },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const filter = { client: ctx.clientId(), internalOnly: false };
  const [items, total] = await Promise.all([
    Task.find(filter)
      .sort({ dueDate: 1 })
      .skip(page.skip)
      .limit(page.limit)
      .select('title status dueDate')
      .lean<Lean<TaskAttributes>[]>()
      .exec(),
    Task.countDocuments(filter).exec(),
  ]);
  sendList(ctx.res, items.map(serialiseTaskForPortal), buildPageMeta(total, page));
};

export const requests = async (
  input: { query: { page: number; limit: number; status?: string } },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const filter: Record<string, unknown> = { client: ctx.clientId() };
  filter.status = input.query.status ?? 'open';
  const [items, total] = await Promise.all([
    DocumentRequest.find(filter)
      .sort({ dueDate: 1, createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .lean<Lean<DocumentRequestAttributes>[]>()
      .exec(),
    DocumentRequest.countDocuments(filter).exec(),
  ]);
  sendList(ctx.res, items.map(serialiseDocumentRequestForPortal), buildPageMeta(total, page));
};

export const profile = async (_input: unknown, ctx: RouteContext): Promise<void> => {
  const clientId = ctx.clientId();
  const record = await Client.findById(clientId).lean<Lean<ClientAttributes> | null>().exec();
  if (!record) throw notFound('client');
  sendData(ctx.res, serialiseClientForPortal(record, await clientHasAadhaar(clientId)));
};

export const updateProfile = async (
  input: { body: ProfileBody },
  ctx: RouteContext,
): Promise<void> => {
  const clientId = ctx.clientId();
  const record = await updateClient(
    clientId,
    {
      primaryContact: input.body.primaryContact,
      additionalContacts: input.body.additionalContacts,
      address: input.body.address,
    },
    ctx.actor,
  );
  sendData(ctx.res, serialiseClientForPortal(record, await clientHasAadhaar(clientId)));
};

export const aadhaar = async (_input: unknown, ctx: RouteContext): Promise<void> => {
  if (ctx.user.role !== 'client') throw forbidden();
  const clientId: Types.ObjectId = ctx.clientId();
  const value = await revealAadhaar(clientId, ctx.actor);
  sendData(ctx.res, { aadhaar: value });
};

export const activity = async (
  input: { query: { page: number; limit: number } },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const clientId = ctx.clientId();
  const { listAudit } = await import('../services/audit.service.js');
  const { items, total } = await listAudit({ client: clientId.toString() }, page);
  sendList(
    ctx.res,
    items.map((entry) => ({
      id: entry._id.toString(),
      action: entry.action,
      summary: entry.summary,
      createdAt: entry.createdAt.toISOString(),
    })),
    buildPageMeta(total, page),
  );
};

export const submitOnboarding = async (
  input: { body: OnboardingBody },
  ctx: RouteContext,
): Promise<void> => {
  const result = await submitClientOnboarding(input.body, ctx.user, ctx.actor);
  sendData(ctx.res, {
    client: serialiseClientForPortal(result.client, Boolean(input.body.aadhaar)),
    clientId: result.client._id.toString(),
  });
};

