import type { Types } from 'mongoose';

import { addDays, todayIST } from '../lib/date.js';
import { CLOSED_COMPLIANCE_STATUSES } from '../lib/enums.js';
import type { ComplianceCategory, ComplianceStatus } from '../lib/enums.js';
import { Client } from '../models/client.model.js';
import { ClientService } from '../models/clientService.model.js';
import { ComplianceItem } from '../models/complianceItem.model.js';
import { DocumentRequest } from '../models/documentRequest.model.js';
import { Task } from '../models/task.model.js';
import { User } from '../models/user.model.js';
import type { AuthenticatedUser } from '../types/context.js';
import { accessibleClientIds } from './compliance.service.js';
import { buildComplianceFilter } from './compliance.service.js';

export interface ReportFilters {
  dateFrom?: Date;
  dateTo?: Date;
  client?: string;
  complianceType?: string;
  category?: ComplianceCategory;
  status?: ComplianceStatus;
}

export interface ComplianceReportRow {
  id: string;
  clientName: string;
  complianceTypeName: string;
  category: string;
  periodLabel: string;
  dueDate: Date;
  status: ComplianceStatus;
  isOverdue: boolean;
  filedDate: Date | null;
  assignedStaffName: string | null;
}

export interface ComplianceReport {
  rows: ComplianceReportRow[];
  totals: Record<ComplianceStatus | 'overdue' | 'all', number>;
}

const named = (value: unknown, key: string): string | null => {
  if (value === null || value === undefined || typeof value !== 'object') return null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'string' ? candidate : null;
};

export const complianceReport = async (
  user: AuthenticatedUser,
  filters: ReportFilters,
): Promise<ComplianceReport> => {
  const filter = await buildComplianceFilter(user, {
    client: filters.client,
    complianceType: filters.complianceType,
    category: filters.category,
    status: filters.status,
    dueFrom: filters.dateFrom,
    dueTo: filters.dateTo,
  });
  const items = await ComplianceItem.find(filter)
    .sort({ dueDate: 1 })
    .limit(5000)
    .populate('client', 'displayName')
    .populate('complianceType', 'name category')
    .populate('assignedStaff', 'name')
    .lean()
    .exec();

  const today = todayIST();
  const totals: Record<ComplianceStatus | 'overdue' | 'all', number> = {
    pending: 0,
    in_progress: 0,
    awaiting_client: 0,
    filed: 0,
    acknowledged: 0,
    not_applicable: 0,
    overdue: 0,
    all: items.length,
  };

  const rows = items.map((item) => {
    const isOverdue =
      item.dueDate < today && !CLOSED_COMPLIANCE_STATUSES.includes(item.status);
    totals[item.status] += 1;
    if (isOverdue) totals.overdue += 1;
    return {
      id: item._id.toString(),
      clientName: named(item.client, 'displayName') ?? 'Unknown client',
      complianceTypeName: named(item.complianceType, 'name') ?? 'Unknown filing',
      category: named(item.complianceType, 'category') ?? 'other',
      periodLabel: item.periodLabel,
      dueDate: item.dueDate,
      status: item.status,
      isOverdue,
      filedDate: item.filedDate ?? null,
      assignedStaffName: named(item.assignedStaff, 'name'),
    };
  });

  return { rows, totals };
};

export interface WorkloadRow {
  staffId: string;
  staffName: string;
  openTasks: number;
  overdueTasks: number;
  completedTasks: number;
  openFilings: number;
  overdueFilings: number;
  estimateMinutes: number;
  loggedMinutes: number;
}

export const workloadReport = async (
  user: AuthenticatedUser,
  filters: ReportFilters,
): Promise<WorkloadRow[]> => {
  const staff =
    user.role === 'admin'
      ? await User.find({ role: { $in: ['admin', 'staff'] }, status: 'active' })
          .select('name')
          .sort({ name: 1 })
          .lean()
          .exec()
      : await User.find({ _id: user.id }).select('name').lean().exec();

  const today = todayIST();
  const dateFilter =
    filters.dateFrom || filters.dateTo
      ? {
          ...(filters.dateFrom ? { $gte: filters.dateFrom } : {}),
          ...(filters.dateTo ? { $lte: filters.dateTo } : {}),
        }
      : undefined;

  const rows: WorkloadRow[] = [];
  for (const member of staff) {
    const taskBase = { assignee: member._id, ...(dateFilter ? { dueDate: dateFilter } : {}) };
    const filingBase = {
      assignedStaff: member._id,
      ...(dateFilter ? { dueDate: dateFilter } : {}),
    };

    const [openTasks, overdueTasks, completedTasks, openFilings, overdueFilings, minutes] =
      await Promise.all([
        Task.countDocuments({ ...taskBase, status: { $ne: 'done' } }).exec(),
        Task.countDocuments({
          ...taskBase,
          status: { $ne: 'done' },
          dueDate: { ...(dateFilter ?? {}), $lt: today },
        }).exec(),
        Task.countDocuments({ ...taskBase, status: 'done' }).exec(),
        ComplianceItem.countDocuments({
          ...filingBase,
          status: { $nin: CLOSED_COMPLIANCE_STATUSES },
        }).exec(),
        ComplianceItem.countDocuments({
          ...filingBase,
          status: { $nin: CLOSED_COMPLIANCE_STATUSES },
          dueDate: { ...(dateFilter ?? {}), $lt: today },
        }).exec(),
        Task.aggregate<{ _id: null; estimate: number; logged: number }>([
          { $match: taskBase },
          {
            $group: {
              _id: null,
              estimate: { $sum: { $ifNull: ['$estimateMinutes', 0] } },
              logged: { $sum: { $ifNull: ['$loggedMinutes', 0] } },
            },
          },
        ]).exec(),
      ]);

    rows.push({
      staffId: member._id.toString(),
      staffName: member.name,
      openTasks,
      overdueTasks,
      completedTasks,
      openFilings,
      overdueFilings,
      estimateMinutes: minutes[0]?.estimate ?? 0,
      loggedMinutes: minutes[0]?.logged ?? 0,
    });
  }
  return rows;
};

export interface RosterRow {
  clientId: string;
  displayName: string;
  clientType: string;
  status: string;
  services: string[];
  assignedStaff: string[];
  nextDueDate: Date | null;
  openRequests: number;
}

export const rosterReport = async (
  user: AuthenticatedUser,
  filters: ReportFilters,
): Promise<RosterRow[]> => {
  const scoped = await accessibleClientIds(user);
  const clientFilter: Record<string, unknown> = { archived: false };
  if (scoped !== null) clientFilter._id = { $in: scoped };
  if (filters.client) clientFilter._id = filters.client;

  const clients = await Client.find(clientFilter)
    .sort({ displayName: 1 })
    .limit(5000)
    .populate('assignedStaff', 'name')
    .lean()
    .exec();
  if (clients.length === 0) return [];

  const clientIds = clients.map((client) => client._id);
  const [services, dues, requests] = await Promise.all([
    ClientService.find({ client: { $in: clientIds }, active: true })
      .populate('complianceType', 'name')
      .select('client complianceType')
      .lean()
      .exec(),
    ComplianceItem.aggregate<{ _id: Types.ObjectId; nextDueDate: Date }>([
      {
        $match: {
          client: { $in: clientIds },
          status: { $nin: CLOSED_COMPLIANCE_STATUSES },
        },
      },
      { $group: { _id: '$client', nextDueDate: { $min: '$dueDate' } } },
    ]).exec(),
    DocumentRequest.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { client: { $in: clientIds }, status: 'open' } },
      { $group: { _id: '$client', count: { $sum: 1 } } },
    ]).exec(),
  ]);

  const serviceMap = new Map<string, string[]>();
  for (const service of services) {
    const key = service.client.toString();
    const name = named(service.complianceType, 'name') ?? 'Unnamed service';
    serviceMap.set(key, [...(serviceMap.get(key) ?? []), name]);
  }
  const dueMap = new Map(dues.map((row) => [row._id.toString(), row.nextDueDate]));
  const requestMap = new Map(requests.map((row) => [row._id.toString(), row.count]));

  return clients.map((client) => {
    const key = client._id.toString();
    return {
      clientId: key,
      displayName: client.displayName,
      clientType: client.clientType,
      status: client.status,
      services: (serviceMap.get(key) ?? []).sort((a, b) => a.localeCompare(b)),
      assignedStaff: client.assignedStaff
        .map((staff) => named(staff, 'name'))
        .filter((name): name is string => name !== null),
      nextDueDate: dueMap.get(key) ?? null,
      openRequests: requestMap.get(key) ?? 0,
    };
  });
};

export interface DashboardSummary {
  clientCount: number;
  tasksByStatus: Record<string, number>;
  dueIn7: number;
  dueIn14: number;
  dueIn30: number;
  overdueFilings: number;
  awaitingClient: number;
  openRequests: number;
  workload: Array<{ staffId: string; staffName: string; openItems: number }>;
}

export const dashboardSummary = async (user: AuthenticatedUser): Promise<DashboardSummary> => {
  const scoped = await accessibleClientIds(user);
  const clientScope = scoped === null ? {} : { client: { $in: scoped } };
  const today = todayIST();

  const dueWithin = (days: number): Record<string, unknown> => ({
    ...clientScope,
    status: { $nin: CLOSED_COMPLIANCE_STATUSES },
    dueDate: { $gte: today, $lte: addDays(today, days) },
  });

  const [
    clientCount,
    taskRows,
    dueIn7,
    dueIn14,
    dueIn30,
    overdueFilings,
    awaitingClient,
    openRequests,
    staff,
  ] = await Promise.all([
    Client.countDocuments(scoped === null ? { archived: false } : { _id: { $in: scoped }, archived: false }).exec(),
    Task.aggregate<{ _id: string; count: number }>([
      { $match: scoped === null ? {} : { $or: [{ client: { $in: scoped } }, { client: null, assignee: user.id }] } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).exec(),
    ComplianceItem.countDocuments(dueWithin(7)).exec(),
    ComplianceItem.countDocuments(dueWithin(14)).exec(),
    ComplianceItem.countDocuments(dueWithin(30)).exec(),
    ComplianceItem.countDocuments({
      ...clientScope,
      status: { $nin: CLOSED_COMPLIANCE_STATUSES },
      dueDate: { $lt: today },
    }).exec(),
    ComplianceItem.countDocuments({ ...clientScope, status: 'awaiting_client' }).exec(),
    DocumentRequest.countDocuments({ ...clientScope, status: 'open' }).exec(),
    user.role === 'admin'
      ? User.find({ role: { $in: ['admin', 'staff'] }, status: 'active' })
          .select('name')
          .lean()
          .exec()
      : User.find({ _id: user.id }).select('name').lean().exec(),
  ]);

  const tasksByStatus: Record<string, number> = {
    not_started: 0,
    in_progress: 0,
    review: 0,
    done: 0,
  };
  for (const row of taskRows) tasksByStatus[row._id] = row.count;

  const workload = await Promise.all(
    staff.map(async (member) => {
      const [tasks, filings] = await Promise.all([
        Task.countDocuments({ assignee: member._id, status: { $ne: 'done' } }).exec(),
        ComplianceItem.countDocuments({
          assignedStaff: member._id,
          status: { $nin: CLOSED_COMPLIANCE_STATUSES },
        }).exec(),
      ]);
      return {
        staffId: member._id.toString(),
        staffName: member.name,
        openItems: tasks + filings,
      };
    }),
  );

  return {
    clientCount,
    tasksByStatus,
    dueIn7,
    dueIn14,
    dueIn30,
    overdueFilings,
    awaitingClient,
    openRequests,
    workload: workload.sort((a, b) => b.openItems - a.openItems),
  };
};
