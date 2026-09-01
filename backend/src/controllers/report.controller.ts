import type { z } from 'zod';

import { buildCsv, csvFilename } from '../lib/csv.js';
import { formatDateOnly } from '../lib/date.js';
import { sendCsv, sendData } from '../lib/http.js';
import type { RouteContext } from '../middleware/validate.js';
import { recordAudit } from '../services/audit.service.js';
import {
  complianceReport,
  dashboardSummary,
  rosterReport,
  workloadReport,
} from '../services/report.service.js';
import type { reportFiltersQuery, reportNameParam } from '../validators/report.validators.js';

type Filters = z.infer<typeof reportFiltersQuery>;
type NameParam = z.infer<typeof reportNameParam>;

export const dashboard = async (_input: unknown, ctx: RouteContext): Promise<void> => {
  sendData(ctx.res, await dashboardSummary(ctx.user));
};

export const compliance = async (
  input: { query: Filters },
  ctx: RouteContext,
): Promise<void> => {
  const report = await complianceReport(ctx.user, input.query);
  sendData(ctx.res, {
    totals: report.totals,
    rows: report.rows.map((row) => ({
      ...row,
      dueDate: formatDateOnly(row.dueDate),
      filedDate: formatDateOnly(row.filedDate),
    })),
  });
};

export const workload = async (
  input: { query: Filters },
  ctx: RouteContext,
): Promise<void> => {
  sendData(ctx.res, await workloadReport(ctx.user, input.query));
};

export const roster = async (input: { query: Filters }, ctx: RouteContext): Promise<void> => {
  const rows = await rosterReport(ctx.user, input.query);
  sendData(
    ctx.res,
    rows.map((row) => ({ ...row, nextDueDate: formatDateOnly(row.nextDueDate) })),
  );
};

export const exportReport = async (
  input: { params: NameParam; query: Filters },
  ctx: RouteContext,
): Promise<void> => {
  let csv: string;
  let rowCount: number;

  if (input.params.name === 'compliance') {
    const report = await complianceReport(ctx.user, input.query);
    rowCount = report.rows.length;
    csv = buildCsv(report.rows, [
      { header: 'Client', value: (row) => row.clientName },
      { header: 'Filing', value: (row) => row.complianceTypeName },
      { header: 'Category', value: (row) => row.category },
      { header: 'Period', value: (row) => row.periodLabel },
      { header: 'Due date', value: (row) => formatDateOnly(row.dueDate) },
      { header: 'Status', value: (row) => row.status },
      { header: 'Overdue', value: (row) => (row.isOverdue ? 'Yes' : 'No') },
      { header: 'Filed date', value: (row) => formatDateOnly(row.filedDate) },
      { header: 'Assigned to', value: (row) => row.assignedStaffName ?? '' },
    ]);
  } else if (input.params.name === 'workload') {
    const rows = await workloadReport(ctx.user, input.query);
    rowCount = rows.length;
    csv = buildCsv(rows, [
      { header: 'Staff member', value: (row) => row.staffName },
      { header: 'Open tasks', value: (row) => row.openTasks },
      { header: 'Overdue tasks', value: (row) => row.overdueTasks },
      { header: 'Completed tasks', value: (row) => row.completedTasks },
      { header: 'Open filings', value: (row) => row.openFilings },
      { header: 'Overdue filings', value: (row) => row.overdueFilings },
      { header: 'Estimated minutes', value: (row) => row.estimateMinutes },
      { header: 'Logged minutes', value: (row) => row.loggedMinutes },
    ]);
  } else {
    const rows = await rosterReport(ctx.user, input.query);
    rowCount = rows.length;
    csv = buildCsv(rows, [
      { header: 'Client', value: (row) => row.displayName },
      { header: 'Type', value: (row) => row.clientType },
      { header: 'Status', value: (row) => row.status },
      { header: 'Services', value: (row) => row.services.join('; ') },
      { header: 'Assigned staff', value: (row) => row.assignedStaff.join('; ') },
      { header: 'Next deadline', value: (row) => formatDateOnly(row.nextDueDate) },
      { header: 'Open requests', value: (row) => row.openRequests },
    ]);
  }

  await recordAudit({
    actor: ctx.actor,
    action: 'export',
    entityKind: 'complianceItem',
    summary: `Exported the ${input.params.name} report with ${rowCount} row${rowCount === 1 ? '' : 's'}`,
  });
  sendCsv(ctx.res, csvFilename(`firmdesk-${input.params.name}`), csv);
};
