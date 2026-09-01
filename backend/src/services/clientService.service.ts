import type { Types } from 'mongoose';

import { conflict, notFound, validationFailed } from '../lib/errors.js';
import type { Frequency } from '../lib/enums.js';
import { containsId } from '../lib/scope.js';
import type { ClientServiceAttributes } from '../models/clientService.model.js';
import { ClientService } from '../models/clientService.model.js';
import { Client } from '../models/client.model.js';
import { ComplianceItem } from '../models/complianceItem.model.js';
import { ComplianceType } from '../models/complianceType.model.js';
import type { RequestActor } from '../types/context.js';
import type { Lean } from '../types/lean.js';
import { buildDiff, recordAudit } from './audit.service.js';

export interface ClientServiceWrite {
  complianceTypeId?: string;
  frequency?: Frequency | null;
  startDate?: Date;
  endDate?: Date | null;
  assignedStaff?: string | null;
  active?: boolean;
}

const assertAssigneeOnClient = async (
  clientId: Types.ObjectId,
  staffId: string | null | undefined,
): Promise<void> => {
  if (staffId === null || staffId === undefined) return;
  const client = await Client.findById(clientId).select('assignedStaff').lean().exec();
  if (!client) throw notFound('client');
  if (!containsId(client.assignedStaff, staffId)) {
    throw validationFailed('That staff member is not assigned to this client.', [
      {
        field: 'assignedStaff',
        message: 'Assign the staff member to the client first, then pick them here.',
      },
    ]);
  }
};

export const listClientServices = async (
  clientId: Types.ObjectId,
): Promise<Lean<ClientServiceAttributes>[]> =>
  ClientService.find({ client: clientId })
    .sort({ active: -1, startDate: -1 })
    .populate('complianceType', 'name code category defaultFrequency isRecurring active')
    .populate('assignedStaff', 'name email role')
    .lean<Lean<ClientServiceAttributes>[]>()
    .exec();

export const getClientService = async (
  id: Types.ObjectId,
): Promise<Lean<ClientServiceAttributes>> => {
  const record = await ClientService.findById(id)
    .populate('complianceType', 'name code category defaultFrequency isRecurring active')
    .populate('assignedStaff', 'name email role')
    .lean<Lean<ClientServiceAttributes> | null>()
    .exec();
  if (!record) throw notFound('client service');
  return record;
};

export const clientIdOfService = async (id: Types.ObjectId): Promise<Types.ObjectId> => {
  const record = await ClientService.findById(id).select('client').lean().exec();
  if (!record) throw notFound('client service');
  return record.client;
};

export const createClientService = async (
  clientId: Types.ObjectId,
  payload: ClientServiceWrite,
  actor: RequestActor,
): Promise<Lean<ClientServiceAttributes>> => {
  if (payload.complianceTypeId === undefined || payload.startDate === undefined) {
    throw validationFailed('A client service needs a catalogue entry and a start date.', [
      { field: 'complianceTypeId', message: 'Choose a catalogue entry.' },
    ]);
  }
  const type = await ComplianceType.findById(payload.complianceTypeId).lean().exec();
  if (!type) throw notFound('compliance type');
  if (!type.active) {
    throw conflict(`${type.name} is deactivated and cannot be added as a new service.`);
  }
  await assertAssigneeOnClient(clientId, payload.assignedStaff);

  const existing = await ClientService.findOne({
    client: clientId,
    complianceType: payload.complianceTypeId,
  })
    .select('_id')
    .lean()
    .exec();
  if (existing) {
    throw conflict(`This client already subscribes to ${type.name}.`);
  }

  const created = await ClientService.create({
    client: clientId,
    complianceType: payload.complianceTypeId,
    frequency: payload.frequency ?? null,
    startDate: payload.startDate,
    endDate: payload.endDate ?? null,
    assignedStaff: payload.assignedStaff ?? null,
    active: payload.active ?? true,
    createdBy: actor.id,
    updatedBy: actor.id,
  });

  await recordAudit({
    actor,
    action: 'create',
    entityKind: 'clientService',
    entityId: created._id,
    client: clientId,
    summary: `Added service ${type.name}`,
  });
  return getClientService(created._id);
};

const WRITABLE = ['frequency', 'startDate', 'endDate', 'assignedStaff', 'active'] as const;

export const updateClientService = async (
  id: Types.ObjectId,
  payload: ClientServiceWrite,
  actor: RequestActor,
): Promise<Lean<ClientServiceAttributes>> => {
  const doc = await ClientService.findById(id).exec();
  if (!doc) throw notFound('client service');
  if (payload.complianceTypeId !== undefined) {
    throw conflict('A client service cannot be moved to a different catalogue entry.');
  }
  await assertAssigneeOnClient(doc.client, payload.assignedStaff);

  const before: Record<string, unknown> = {};
  for (const field of WRITABLE) before[field] = doc.get(field);
  for (const field of WRITABLE) {
    const value = payload[field];
    if (value !== undefined) doc.set(field, value);
  }
  doc.set('updatedBy', actor.id);
  await doc.save();

  const after: Record<string, unknown> = {};
  for (const field of WRITABLE) after[field] = doc.get(field);

  const diff = buildDiff(before, after);
  if (diff.length > 0) {
    await recordAudit({
      actor,
      action: 'update',
      entityKind: 'clientService',
      entityId: doc._id,
      client: doc.client,
      summary: 'Updated a client service',
      diff,
    });
  }
  return getClientService(id);
};

export const deleteClientService = async (
  id: Types.ObjectId,
  actor: RequestActor,
): Promise<void> => {
  const doc = await ClientService.findById(id).exec();
  if (!doc) throw notFound('client service');
  const generated = await ComplianceItem.countDocuments({ clientService: id }).exec();
  if (generated > 0) {
    throw conflict(
      `This service has already produced ${generated} filing${generated === 1 ? '' : 's'}, so it cannot be deleted. Deactivate it instead.`,
    );
  }
  const clientId = doc.client;
  await doc.deleteOne();
  await recordAudit({
    actor,
    action: 'hard_delete',
    entityKind: 'clientService',
    entityId: id,
    client: clientId,
    summary: 'Deleted a client service that had generated nothing',
  });
};
