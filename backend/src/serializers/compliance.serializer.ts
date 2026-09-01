import type { ComplianceItemAttributes } from '../models/complianceItem.model.js';
import type { ComplianceTypeAttributes } from '../models/complianceType.model.js';
import type { ClientServiceAttributes } from '../models/clientService.model.js';
import { isOverdue } from '../services/compliance.service.js';
import type { Lean } from '../types/lean.js';
import { dateOnly, idOf, namedRef, personRef, textOf, timestamp } from './common.js';
import type { NamedRef, PersonRef } from './common.js';

type ItemRecord = Lean<ComplianceItemAttributes>;

export interface ComplianceTypeRef {
  id: string;
  name: string;
  category: string;
}

const typeRef = (value: unknown): ComplianceTypeRef | null => {
  const id = idOf(value);
  if (id === null) return null;
  return {
    id,
    name: textOf(value, 'name') ?? '',
    category: textOf(value, 'category') ?? 'other',
  };
};

export interface ComplianceListRow {
  id: string;
  client: NamedRef | null;
  complianceType: ComplianceTypeRef | null;
  periodType: string;
  periodLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  dueDate: string | null;
  dueDateOverridden: boolean;
  status: string;
  isOverdue: boolean;
  assignedStaff: PersonRef | null;
  filedDate: string | null;
  requestProgress: { received: number; total: number };
}

export const serialiseComplianceRow = (
  item: ItemRecord,
  progress: { received: number; total: number } | undefined,
): ComplianceListRow => ({
  id: item._id.toString(),
  client: namedRef(item.client, 'displayName'),
  complianceType: typeRef(item.complianceType),
  periodType: item.periodType,
  periodLabel: item.periodLabel,
  periodStart: dateOnly(item.periodStart),
  periodEnd: dateOnly(item.periodEnd),
  dueDate: dateOnly(item.dueDate),
  dueDateOverridden: item.dueDateOverridden,
  status: item.status,
  isOverdue: isOverdue(item),
  assignedStaff: personRef(item.assignedStaff),
  filedDate: dateOnly(item.filedDate),
  requestProgress: progress ?? { received: 0, total: 0 },
});

export interface ComplianceDetail extends ComplianceListRow {
  notes: string | null;
  acknowledgementRef: string | null;
  notApplicableReason: string | null;
  generatedBy: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export const serialiseComplianceDetail = (
  item: ItemRecord,
  progress: { received: number; total: number } | undefined,
): ComplianceDetail => ({
  ...serialiseComplianceRow(item, progress),
  notes: item.notes ?? null,
  acknowledgementRef: item.acknowledgementRef ?? null,
  notApplicableReason: item.notApplicableReason ?? null,
  generatedBy: item.generatedBy,
  createdAt: timestamp(item.createdAt),
  updatedAt: timestamp(item.updatedAt),
});

export interface PortalComplianceRow {
  id: string;
  complianceTypeName: string;
  periodLabel: string;
  dueDate: string | null;
  status: string;
  isOverdue: boolean;
  filedDate: string | null;
}

export const serialiseComplianceForPortal = (item: ItemRecord): PortalComplianceRow => ({
  id: item._id.toString(),
  complianceTypeName: textOf(item.complianceType, 'name') ?? 'Filing',
  periodLabel: item.periodLabel,
  dueDate: dateOnly(item.dueDate),
  status: item.status,
  isOverdue: isOverdue(item),
  filedDate: dateOnly(item.filedDate),
});

export interface ComplianceTypeView {
  id: string;
  name: string;
  code: string;
  category: string;
  isRecurring: boolean;
  defaultFrequency: string;
  dueDateRule: ComplianceTypeAttributes['dueDateRule'];
  defaultDocumentChecklist: ComplianceTypeAttributes['defaultDocumentChecklist'];
  reminderOffsetsDays: number[];
  isSeeded: boolean;
  active: boolean;
}

export const serialiseComplianceType = (
  type: Lean<ComplianceTypeAttributes>,
): ComplianceTypeView => ({
  id: type._id.toString(),
  name: type.name,
  code: type.code,
  category: type.category,
  isRecurring: type.isRecurring,
  defaultFrequency: type.defaultFrequency,
  dueDateRule: type.dueDateRule ?? null,
  defaultDocumentChecklist: type.defaultDocumentChecklist,
  reminderOffsetsDays: type.reminderOffsetsDays,
  isSeeded: type.isSeeded,
  active: type.active,
});

export interface ClientServiceView {
  id: string;
  complianceType: ComplianceTypeRef | null;
  frequency: string | null;
  startDate: string | null;
  endDate: string | null;
  assignedStaff: PersonRef | null;
  active: boolean;
}

export const serialiseClientService = (
  service: Lean<ClientServiceAttributes>,
): ClientServiceView => ({
  id: service._id.toString(),
  complianceType: typeRef(service.complianceType),
  frequency: service.frequency ?? null,
  startDate: dateOnly(service.startDate),
  endDate: dateOnly(service.endDate),
  assignedStaff: personRef(service.assignedStaff),
  active: service.active,
});
