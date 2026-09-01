import type { ClientListExtras } from '../services/client.service.js';
import type { ClientAttributes } from '../models/client.model.js';
import type { Lean } from '../types/lean.js';
import { dateOnly, idOf, personRefs, timestamp } from './common.js';
import type { PersonRef } from './common.js';

type ClientRecord = Lean<ClientAttributes>;

export interface ClientListRow {
  id: string;
  displayName: string;
  clientType: string;
  status: string;
  pan: string | null;
  gstin: string | null;
  primaryContact: ClientAttributes['primaryContact'];
  assignedStaff: PersonRef[];
  nextDueDate: string | null;
  openRequestCount: number;
  unreadMessageCount: number;
  pinned: boolean;
  archived: boolean;
}

export const serialiseClientRow = (
  client: ClientRecord,
  extras: ClientListExtras | undefined,
): ClientListRow => ({
  id: client._id.toString(),
  displayName: client.displayName,
  clientType: client.clientType,
  status: client.status,
  pan: client.pan ?? null,
  gstin: client.gstin ?? null,
  primaryContact: client.primaryContact,
  assignedStaff: personRefs(client.assignedStaff),
  nextDueDate: dateOnly(extras?.nextDueDate ?? null),
  openRequestCount: extras?.openRequestCount ?? 0,
  unreadMessageCount: extras?.unreadMessageCount ?? 0,
  pinned: extras?.pinned ?? false,
  archived: client.archived,
});

const commonDetail = (client: ClientRecord) => ({
  id: client._id.toString(),
  clientType: client.clientType,
  displayName: client.displayName,
  legalName: client.legalName ?? null,
  status: client.status,
  archived: client.archived,
  archivedAt: timestamp(client.archivedAt),
  pan: client.pan ?? null,
  gstin: client.gstin ?? null,
  tan: client.tan ?? null,
  cin: client.cin ?? null,
  entityType: client.entityType ?? null,
  incorporationDate: dateOnly(client.incorporationDate),
  dateOfBirth: dateOnly(client.dateOfBirth),
  primaryContact: client.primaryContact,
  additionalContacts: client.additionalContacts,
  address: client.address ?? null,
  assignedStaff: personRefs(client.assignedStaff),
  createdAt: timestamp(client.createdAt),
  updatedAt: timestamp(client.updatedAt),
});

export type StaffClientDetail = ReturnType<typeof commonDetail> & { notes: string | null };

export const serialiseClientForStaff = (client: ClientRecord): StaffClientDetail => ({
  ...commonDetail(client),
  notes: client.notes ?? null,
});

export type AdminClientDetail = StaffClientDetail & { aadhaarPresent: boolean };

export const serialiseClientForAdmin = (
  client: ClientRecord,
  aadhaarPresent: boolean,
): AdminClientDetail => ({
  ...serialiseClientForStaff(client),
  aadhaarPresent,
});

export interface PortalClientProfile {
  id: string;
  displayName: string;
  legalName: string | null;
  clientType: string;
  status: string;
  pan: string | null;
  gstin: string | null;
  tan: string | null;
  cin: string | null;
  entityType: string | null;
  incorporationDate: string | null;
  dateOfBirth: string | null;
  aadhaarPresent: boolean;
  primaryContact: ClientAttributes['primaryContact'];
  additionalContacts: ClientAttributes['additionalContacts'];
  address: ClientAttributes['address'];
}

export const serialiseClientForPortal = (
  client: ClientRecord,
  aadhaarPresent: boolean,
): PortalClientProfile => ({
  id: client._id.toString(),
  displayName: client.displayName,
  legalName: client.legalName ?? null,
  clientType: client.clientType,
  status: client.status,
  pan: client.pan ?? null,
  gstin: client.gstin ?? null,
  tan: client.tan ?? null,
  cin: client.cin ?? null,
  entityType: client.entityType ?? null,
  incorporationDate: dateOnly(client.incorporationDate),
  dateOfBirth: dateOnly(client.dateOfBirth),
  aadhaarPresent,
  primaryContact: client.primaryContact,
  additionalContacts: client.additionalContacts,
  address: client.address ?? null,
});

export interface PortalClientOption {
  id: string;
  displayName: string;
}

export const serialisePortalClientOption = (client: ClientRecord): PortalClientOption => ({
  id: idOf(client) ?? client._id.toString(),
  displayName: client.displayName,
});
