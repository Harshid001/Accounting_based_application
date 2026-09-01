import { todayIST } from '../lib/date.js';
import type { DocumentRequestAttributes } from '../models/documentRequest.model.js';
import type { Lean } from '../types/lean.js';
import { dateOnly, idOf, namedRef, personRef, timestamp } from './common.js';
import type { NamedRef, PersonRef } from './common.js';

type RequestRecord = Lean<DocumentRequestAttributes>;

const overdue = (request: RequestRecord): boolean =>
  request.status === 'open' &&
  request.dueDate !== null &&
  request.dueDate !== undefined &&
  request.dueDate.getTime() < todayIST().getTime();

export interface DocumentRequestView {
  id: string;
  client: NamedRef | null;
  complianceItem: { id: string; periodLabel: string | null } | null;
  title: string;
  description: string | null;
  documentType: string;
  dueDate: string | null;
  status: string;
  isOverdue: boolean;
  fulfilledDocumentId: string | null;
  fulfilledAt: string | null;
  requestedBy: PersonRef | null;
  lastRemindedAt: string | null;
  createdAt: string | null;
}

export const serialiseDocumentRequest = (request: RequestRecord): DocumentRequestView => {
  const linked = namedRef(request.complianceItem, 'periodLabel');
  return {
    id: request._id.toString(),
    client: namedRef(request.client, 'displayName'),
    complianceItem: linked === null ? null : { id: linked.id, periodLabel: linked.name },
    title: request.title,
    description: request.description ?? null,
    documentType: request.documentType,
    dueDate: dateOnly(request.dueDate),
    status: request.status,
    isOverdue: overdue(request),
    fulfilledDocumentId: idOf(request.fulfilledBy),
    fulfilledAt: timestamp(request.fulfilledAt),
    requestedBy: personRef(request.requestedBy),
    lastRemindedAt: timestamp(request.lastRemindedAt),
    createdAt: timestamp(request.createdAt),
  };
};

export interface PortalDocumentRequestView {
  id: string;
  title: string;
  description: string | null;
  documentType: string;
  dueDate: string | null;
  status: string;
  isOverdue: boolean;
  createdAt: string | null;
}

export const serialiseDocumentRequestForPortal = (
  request: RequestRecord,
): PortalDocumentRequestView => ({
  id: request._id.toString(),
  title: request.title,
  description: request.description ?? null,
  documentType: request.documentType,
  dueDate: dateOnly(request.dueDate),
  status: request.status,
  isOverdue: overdue(request),
  createdAt: timestamp(request.createdAt),
});
