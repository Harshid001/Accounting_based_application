import { todayIST } from '../lib/date.js';
import { CLOSED_COMPLIANCE_STATUSES, TASK_PRIORITY_RANK } from '../lib/enums.js';
import type { ComplianceStatus, TaskPriority, TaskStatus } from '../lib/enums.js';
import type { PageRequest } from '../lib/pagination.js';
import { ComplianceItem } from '../models/complianceItem.model.js';
import { Task } from '../models/task.model.js';
import type { AuthenticatedUser } from '../types/context.js';

export interface WorkRow {
  kind: 'task' | 'compliance';
  id: string;
  title: string;
  clientId: string | null;
  clientName: string | null;
  dueDate: Date | null;
  status: TaskStatus | ComplianceStatus;
  priority: TaskPriority | null;
  isOverdue: boolean;
  link: string;
  periodLabel: string | null;
}

interface PopulatedClient {
  _id: { toString: () => string };
  displayName: string;
}

const readClient = (value: unknown): PopulatedClient | null => {
  if (value === null || value === undefined || typeof value !== 'object') return null;
  const candidate = value as { displayName?: unknown; _id?: unknown };
  if (typeof candidate.displayName !== 'string') return null;
  return value as PopulatedClient;
};

export const listMyWork = async (
  user: AuthenticatedUser,
  page: PageRequest,
): Promise<{ items: WorkRow[]; total: number }> => {
  const today = todayIST();

  const [tasks, items] = await Promise.all([
    Task.find({ assignee: user.id, status: { $ne: 'done' } })
      .populate('client', 'displayName')
      .select('title client dueDate status priority')
      .lean()
      .exec(),
    ComplianceItem.find({
      assignedStaff: user.id,
      status: { $nin: CLOSED_COMPLIANCE_STATUSES },
    })
      .populate('client', 'displayName')
      .populate('complianceType', 'name')
      .select('client complianceType periodLabel dueDate status')
      .lean()
      .exec(),
  ]);

  const rows: WorkRow[] = [];

  for (const task of tasks) {
    const client = readClient(task.client);
    rows.push({
      kind: 'task',
      id: task._id.toString(),
      title: task.title,
      clientId: client?._id.toString() ?? null,
      clientName: client?.displayName ?? null,
      dueDate: task.dueDate ?? null,
      status: task.status,
      priority: task.priority,
      isOverdue: task.dueDate !== null && task.dueDate !== undefined && task.dueDate < today,
      link: `/tasks/${task._id.toString()}`,
      periodLabel: null,
    });
  }

  for (const item of items) {
    const client = readClient(item.client);
    const type = item.complianceType as unknown as { name?: string } | null;
    rows.push({
      kind: 'compliance',
      id: item._id.toString(),
      title: type?.name ?? 'Filing',
      clientId: client?._id.toString() ?? null,
      clientName: client?.displayName ?? null,
      dueDate: item.dueDate,
      status: item.status,
      priority: null,
      isOverdue: item.dueDate < today,
      link: `/compliance/${item._id.toString()}`,
      periodLabel: item.periodLabel,
    });
  }

  rows.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    const aDue = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bDue = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aDue !== bDue) return aDue - bDue;
    const aRank = a.priority === null ? 2 : TASK_PRIORITY_RANK[a.priority];
    const bRank = b.priority === null ? 2 : TASK_PRIORITY_RANK[b.priority];
    if (aRank !== bRank) return aRank - bRank;
    return a.title.localeCompare(b.title);
  });

  return { items: rows.slice(page.skip, page.skip + page.limit), total: rows.length };
};
