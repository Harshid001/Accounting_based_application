// ---------------------------------------------------------------------------
// Automation suggester — Phase E proactive mode
//
// Finds filings that the browser worker COULD file right now (recipe exists,
// preparation ready/locked, no live run, due within the horizon) and surfaces
// them to admins via the daily digest. Suggestions only — a human always
// launches the run; nothing is started automatically.
// ---------------------------------------------------------------------------

import { addDays, formatDisplayDate, todayIST } from '../lib/date.js';
import { CLOSED_COMPLIANCE_STATUSES } from '../lib/enums.js';
import type { AutomationRunStatus } from '../lib/enums.js';
import { ComplianceItem } from '../models/complianceItem.model.js';
import { FilingPreparation } from '../models/filingPreparation.model.js';
import { AutomationRun } from '../models/automationRun.model.js';
import { getAutomationSupport } from './portalAutomation/automationRun.service.js';

export const AUTOMATION_SUGGESTION_HORIZON_DAYS = 7;
const MAX_SUGGESTIONS = 10;

export interface AutomationSuggestion {
  filingId: string;
  clientId: string;
  clientName: string;
  filingName: string;
  formCode: string;
  periodLabel: string;
  dueDate: string;
  preparationStatus: string | null;
  overdue: boolean;
}

const LIVE_RUN_STATUSES: AutomationRunStatus[] = [
  'queued',
  'starting',
  'running',
  'waiting_human',
];

const nameOf = (value: unknown, key: string): string | null => {
  if (value === null || value === undefined || typeof value !== 'object') return null;
  const found = (value as Record<string, unknown>)[key];
  return typeof found === 'string' ? found : null;
};

/**
 * Open filings due within the horizon whose form has an automation recipe,
 * no live run, and a ready-or-locked preparation (or none yet — those are
 * "prepare first" suggestions).
 */
export const findAutomationSuggestions = async (): Promise<AutomationSuggestion[]> => {
  const today = todayIST();
  const horizon = addDays(today, AUTOMATION_SUGGESTION_HORIZON_DAYS);

  const support = await getAutomationSupport();
  if (support.supportedForms.length === 0) return [];

  // Map recipe forms ("GSTR-3B") back to compliance type codes ("GSTR3B").
  const supportedFormNames = new Set(
    support.supportedForms.map((f) => f.form.replace(/-/g, '').toUpperCase()),
  );

  const open = await ComplianceItem.find({
    status: { $nin: CLOSED_COMPLIANCE_STATUSES },
    dueDate: { $lte: horizon },
  })
    .sort({ dueDate: 1 })
    .limit(200)
    .populate('client', 'displayName')
    .populate('complianceType', 'name category code')
    .lean()
    .exec();

  // Filings whose compliance-type code matches a shipped recipe
  const candidates = open.filter((item) => {
    const code = (item.complianceType as { code?: string } | null)?.code ?? '';
    return code.length > 0 && supportedFormNames.has(code.replace(/-/g, '').toUpperCase());
  });
  if (candidates.length === 0) return [];

  const [preparations, liveRunPrepItems] = await Promise.all([
    FilingPreparation.find({
      complianceItem: { $in: candidates.map((c) => c._id) },
    })
      .select('complianceItem status')
      .lean()
      .exec(),
    AutomationRun.find({ status: { $in: LIVE_RUN_STATUSES } })
      .select('complianceItem')
      .lean()
      .exec(),
  ]);

  const prepByItem = new Map(
    preparations.map((p) => [p.complianceItem.toString(), p.status as string]),
  );
  const liveItems = new Set(liveRunPrepItems.map((r) => r.complianceItem.toString()));

  return candidates
    .filter((item) => !liveItems.has(item._id.toString()))
    .slice(0, MAX_SUGGESTIONS)
    .map((item) => {
      const due = item.dueDate instanceof Date ? item.dueDate : null;
      return {
        filingId: item._id.toString(),
        clientId: item.client?._id?.toString() ?? item.client?.toString() ?? '',
        clientName: nameOf(item.client, 'displayName') ?? 'Unknown client',
        filingName: nameOf(item.complianceType, 'name') ?? 'Filing',
        formCode: (item.complianceType as { code?: string } | null)?.code ?? '',
        periodLabel: item.periodLabel,
        dueDate: formatDisplayDate(due),
        preparationStatus: prepByItem.get(item._id.toString()) ?? null,
        overdue: due !== null && due.getTime() < today.getTime(),
      };
    });
};
