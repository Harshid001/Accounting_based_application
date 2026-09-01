import type { Types } from 'mongoose';

import { addDays, todayIST } from '../lib/date.js';
import { evaluateDueDate } from '../lib/dueDate.js';
import type { DueDateRule } from '../lib/dueDate.js';
import { notFound } from '../lib/errors.js';
import { enumeratePeriods, frequencyToPeriodType } from '../lib/period.js';
import type { Period } from '../lib/period.js';
import { Client } from '../models/client.model.js';
import { ClientService } from '../models/clientService.model.js';
import { ComplianceItem } from '../models/complianceItem.model.js';
import { ComplianceType } from '../models/complianceType.model.js';
import type { GeneratedBy } from '../lib/enums.js';
import type { RequestActor } from '../types/context.js';
import { recordAudit } from './audit.service.js';
import { createNotification } from './notification.service.js';
import { complianceHorizonDays } from './settings.service.js';

export interface PlannedItem {
  clientId: Types.ObjectId;
  clientName: string;
  complianceTypeId: Types.ObjectId;
  complianceTypeName: string;
  clientServiceId: Types.ObjectId | null;
  period: Period;
  dueDate: Date;
  assignedStaff: Types.ObjectId | null;
}

export interface SkippedItem {
  clientId: Types.ObjectId;
  clientName: string;
  complianceTypeName: string;
  periodLabel: string;
  reason: string;
}

export interface GenerationPlan {
  willCreate: PlannedItem[];
  willSkip: SkippedItem[];
}

const dueDateFor = (rule: DueDateRule | null | undefined, period: Period): Date =>
  rule ? evaluateDueDate(rule, period.periodEnd) : period.periodEnd;

const existingKeys = async (
  clientIds: readonly Types.ObjectId[],
  typeIds: readonly Types.ObjectId[],
): Promise<Set<string>> => {
  if (clientIds.length === 0 || typeIds.length === 0) return new Set();
  const rows = await ComplianceItem.find({
    client: { $in: [...clientIds] },
    complianceType: { $in: [...typeIds] },
  })
    .select('client complianceType periodStart')
    .lean()
    .exec();
  return new Set(
    rows.map(
      (row) =>
        `${row.client.toString()}|${row.complianceType.toString()}|${row.periodStart.toISOString()}`,
    ),
  );
};

export const planFromClientServices = async (
  windowStart: Date,
  windowEnd: Date,
): Promise<GenerationPlan> => {
  const services = await ClientService.find({ active: true, startDate: { $lte: windowEnd } })
    .populate('complianceType', 'name isRecurring defaultFrequency dueDateRule active')
    .populate('client', 'displayName archived')
    .lean()
    .exec();

  const willCreate: PlannedItem[] = [];
  const willSkip: SkippedItem[] = [];

  const clientIds: Types.ObjectId[] = [];
  const typeIds: Types.ObjectId[] = [];
  for (const service of services) {
    if (!clientIds.some((id) => id.equals(service.client))) clientIds.push(service.client);
    if (!typeIds.some((id) => id.equals(service.complianceType))) {
      typeIds.push(service.complianceType);
    }
  }
  const taken = await existingKeys(clientIds, typeIds);

  for (const service of services) {
    const type = service.complianceType as unknown as {
      _id: Types.ObjectId;
      name: string;
      isRecurring: boolean;
      defaultFrequency: Parameters<typeof frequencyToPeriodType>[0];
      dueDateRule: DueDateRule | null;
      active: boolean;
    };
    const client = service.client as unknown as {
      _id: Types.ObjectId;
      displayName: string;
      archived: boolean;
    };

    const label = `${type.name}`;
    if (client.archived) {
      willSkip.push({
        clientId: client._id,
        clientName: client.displayName,
        complianceTypeName: label,
        periodLabel: '—',
        reason: 'the client is archived',
      });
      continue;
    }
    if (!type.isRecurring || !type.active) {
      willSkip.push({
        clientId: client._id,
        clientName: client.displayName,
        complianceTypeName: label,
        periodLabel: '—',
        reason: type.active ? 'the catalogue entry does not recur' : 'the catalogue entry is inactive',
      });
      continue;
    }

    const frequency = service.frequency ?? type.defaultFrequency;
    const periodType = frequencyToPeriodType(frequency);
    const from = service.startDate > windowStart ? service.startDate : windowStart;
    const to = service.endDate && service.endDate < windowEnd ? service.endDate : windowEnd;

    for (const period of enumeratePeriods(periodType, from, to)) {
      if (period.periodStart < service.startDate) continue;
      if (service.endDate && period.periodEnd > service.endDate) continue;
      const key = `${client._id.toString()}|${type._id.toString()}|${period.periodStart.toISOString()}`;
      if (taken.has(key)) {
        willSkip.push({
          clientId: client._id,
          clientName: client.displayName,
          complianceTypeName: label,
          periodLabel: period.periodLabel,
          reason: 'it already exists',
        });
        continue;
      }
      taken.add(key);
      willCreate.push({
        clientId: client._id,
        clientName: client.displayName,
        complianceTypeId: type._id,
        complianceTypeName: type.name,
        clientServiceId: service._id,
        period,
        dueDate: dueDateFor(type.dueDateRule, period),
        assignedStaff: service.assignedStaff ?? null,
      });
    }
  }

  return { willCreate, willSkip };
};

export interface BulkPlanInput {
  complianceTypeId: string;
  periodStart: Date;
  periodEnd: Date;
  clientIds?: string[];
}

export const planBulk = async (input: BulkPlanInput): Promise<GenerationPlan> => {
  const type = await ComplianceType.findById(input.complianceTypeId).lean().exec();
  if (!type) throw notFound('compliance type');

  const clientFilter =
    input.clientIds && input.clientIds.length > 0
      ? { _id: { $in: input.clientIds }, archived: false }
      : { archived: false };

  const clients = await Client.find(clientFilter).select('displayName').lean().exec();
  const services = await ClientService.find({
    complianceType: type._id,
    client: { $in: clients.map((client) => client._id) },
  })
    .select('client assignedStaff frequency startDate endDate active')
    .lean()
    .exec();
  const serviceByClient = new Map(services.map((service) => [service.client.toString(), service]));

  const taken = await existingKeys(
    clients.map((client) => client._id),
    [type._id],
  );

  const willCreate: PlannedItem[] = [];
  const willSkip: SkippedItem[] = [];

  for (const client of clients) {
    const service = serviceByClient.get(client._id.toString());
    const frequency = service?.frequency ?? type.defaultFrequency;
    const periodType = frequencyToPeriodType(frequency);
    for (const period of enumeratePeriods(periodType, input.periodStart, input.periodEnd)) {
      const key = `${client._id.toString()}|${type._id.toString()}|${period.periodStart.toISOString()}`;
      if (taken.has(key)) {
        willSkip.push({
          clientId: client._id,
          clientName: client.displayName,
          complianceTypeName: type.name,
          periodLabel: period.periodLabel,
          reason: 'it already exists',
        });
        continue;
      }
      taken.add(key);
      willCreate.push({
        clientId: client._id,
        clientName: client.displayName,
        complianceTypeId: type._id,
        complianceTypeName: type.name,
        clientServiceId: service?._id ?? null,
        period,
        dueDate: dueDateFor(type.dueDateRule, period),
        assignedStaff: service?.assignedStaff ?? null,
      });
    }
  }

  return { willCreate, willSkip };
};

export interface CommitResult {
  created: number;
  skipped: number;
  requestsCreated: number;
}

export const commitPlan = async (
  plan: GenerationPlan,
  generatedBy: GeneratedBy,
  actor: RequestActor,
): Promise<CommitResult> => {
  let created = 0;
  let skipped = plan.willSkip.length;
  let requestsCreated = 0;

  const checklistCache = new Map<
    string,
    Array<{ title: string; documentType: string; description?: string | null }>
  >();

  for (const planned of plan.willCreate) {
    try {
      const item = await ComplianceItem.create({
        client: planned.clientId,
        complianceType: planned.complianceTypeId,
        clientService: planned.clientServiceId,
        periodType: planned.period.periodType,
        periodStart: planned.period.periodStart,
        periodEnd: planned.period.periodEnd,
        periodLabel: planned.period.periodLabel,
        dueDate: planned.dueDate,
        dueDateOverridden: false,
        status: 'pending',
        assignedStaff: planned.assignedStaff,
        generatedBy,
        createdBy: actor.id,
        updatedBy: actor.id,
      });
      created += 1;
      requestsCreated += await materialiseChecklist(item._id, planned, checklistCache, actor);
      if (planned.assignedStaff) {
        await createNotification({
          recipient: planned.assignedStaff,
          type: 'deadline_due',
          title: `${planned.complianceTypeName} — ${planned.clientName}`,
          body: `${planned.period.periodLabel} has been added to your list.`,
          link: `/compliance/${item._id.toString()}`,
          entity: { kind: 'complianceItem', id: item._id },
          dedupeKey: `generated:${item._id.toString()}:${planned.assignedStaff.toString()}`,
        });
      }
    } catch (error) {
      if (error !== null && typeof error === 'object' && 'code' in error && error.code === 11000) {
        skipped += 1;
        continue;
      }
      throw error;
    }
  }

  if (created > 0) {
    await recordAudit({
      actor,
      action: 'create',
      entityKind: 'complianceItem',
      summary: `Generated ${created} filing${created === 1 ? '' : 's'} (${generatedBy})`,
    });
  }
  return { created, skipped, requestsCreated };
};

const materialiseChecklist = async (
  complianceItemId: Types.ObjectId,
  planned: PlannedItem,
  cache: Map<string, Array<{ title: string; documentType: string; description?: string | null }>>,
  actor: RequestActor,
): Promise<number> => {
  const key = planned.complianceTypeId.toString();
  if (!cache.has(key)) {
    const type = await ComplianceType.findById(planned.complianceTypeId)
      .select('defaultDocumentChecklist')
      .lean()
      .exec();
    cache.set(key, type?.defaultDocumentChecklist ?? []);
  }
  const checklist = cache.get(key) ?? [];
  if (checklist.length === 0) return 0;

  const { DocumentRequest } = await import('../models/documentRequest.model.js');
  await DocumentRequest.insertMany(
    checklist.map((entry) => ({
      client: planned.clientId,
      complianceItem: complianceItemId,
      title: entry.title,
      description: entry.description ?? null,
      documentType: entry.documentType,
      dueDate: planned.dueDate,
      status: 'open',
      requestedBy: actor.id,
      createdBy: actor.id,
      updatedBy: actor.id,
    })),
  );
  return checklist.length;
};

export const runRollingGeneration = async (actor: RequestActor): Promise<CommitResult> => {
  const horizon = await complianceHorizonDays();
  const start = todayIST();
  const end = addDays(start, horizon);
  const plan = await planFromClientServices(start, end);
  return commitPlan(plan, 'scheduler', actor);
};
