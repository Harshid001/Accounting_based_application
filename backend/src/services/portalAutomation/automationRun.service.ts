import { Types } from 'mongoose';

import { logger } from '../../config/logger.js';
import { conflict, notFound } from '../../lib/errors.js';
import type { AutomationRunMode, AutomationRunStatus } from '../../lib/enums.js';
import { accessibleClientIds } from '../compliance.service.js';
import { ComplianceItem } from '../../models/complianceItem.model.js';
import { ComplianceType } from '../../models/complianceType.model.js';
import { AutomationRun } from '../../models/automationRun.model.js';
import type { AutomationRunDocument } from '../../models/automationRun.model.js';
import { FilingPreparation } from '../../models/filingPreparation.model.js';
import { PortalSession } from '../../models/portalSession.model.js';
import { recordAudit } from '../audit.service.js';
import type { AuthenticatedUser, RequestActor } from '../../types/context.js';
import { loadRecipe, listRecipes } from './recipeEngine.js';
import { automationWorker } from './worker.js';
import { revokeSession } from './sessionVault.js';

// ---------------------------------------------------------------------------
// Portal recipe resolution
//
// Recipes live at recipes/<portalKey>/<formFile>.json where portalKey is the
// compliance category (gst, income_tax, tds, roc) — NOT the human-readable
// portal display name stored on the preparation.
// ---------------------------------------------------------------------------

const CATEGORY_TO_PORTAL: Record<string, string> = {
  gst: 'gst',
  income_tax: 'income_tax',
  tds: 'tds',
  roc: 'roc',
};

// formCode (e.g. GSTR1) → recipe file name (e.g. gstr-1)
const RECIPE_FILE_BY_FORM: Record<string, string> = {
  GSTR1: 'gstr-1',
  GSTR3B: 'gstr-3b',
  GSTR9: 'gstr-9',
  CMP08: 'cmp-08',
  'ITR-IND': 'itr-ind',
  'ITR-CO': 'itr-co',
  'ADV-TAX': 'adv-tax',
  TDS24Q: '24q',
  TDS26Q: '26q',
  'ROC-MGT7': 'mgt-7',
  'ROC-AOC4': 'aoc-4',
  FIXTURE: 'fixture',
};

interface RecipeTarget {
  portalKey: string;
  recipeFile: string;
}

const recipeTargetFor = async (prep: {
  complianceItem: Types.ObjectId;
  formCode: string;
}): Promise<RecipeTarget> => {
  const item = await ComplianceItem.findById(prep.complianceItem)
    .select('complianceType')
    .lean()
    .exec();
  const typeId = item?.complianceType;
  const type = typeId ? await ComplianceType.findById(typeId).select('category').lean().exec() : null;
  const category = type?.category ?? 'gst';
  return {
    portalKey: CATEGORY_TO_PORTAL[category] ?? 'gst',
    recipeFile: RECIPE_FILE_BY_FORM[prep.formCode] ?? prep.formCode,
  };
};

// ---------------------------------------------------------------------------
// executePortalAutomation — shared entry point for the REST controller and
// the AI Copilot's run_portal_automation tool.
// ---------------------------------------------------------------------------

export interface ExecutePortalAutomationInput {
  filingPreparationId: string | Types.ObjectId;
  user: AuthenticatedUser;
  actor: RequestActor;
  mode?: AutomationRunMode;
}

export const executePortalAutomation = async (
  input: ExecutePortalAutomationInput,
): Promise<AutomationRunDocument> => {
  const prepId =
    input.filingPreparationId instanceof Types.ObjectId
      ? input.filingPreparationId
      : new Types.ObjectId(input.filingPreparationId);

  const prep = await FilingPreparation.findById(prepId).exec();
  if (!prep) throw notFound('filing preparation');

  if (prep.status !== 'ready' && prep.status !== 'locked') {
    throw conflict('Filing is not ready. Resolve missing inputs first.');
  }

  // Double-launch guard: never start a second live run for the same preparation.
  const liveRun = await AutomationRun.findOne({
    filingPreparation: prep._id,
    status: { $in: ['queued', 'starting', 'running', 'waiting_human'] },
  })
    .sort({ createdAt: -1 })
    .exec();
  if (liveRun !== null) {
    throw conflict(
      `An automation run is already active for this preparation (run ${liveRun._id.toString()}, status ${liveRun.status}).`,
    );
  }

  // Enforce the caller's client scope (staff can only run for their clients).
  const scoped = await accessibleClientIds(input.user);
  if (scoped !== null && !scoped.some((id) => id.toString() === prep.client.toString())) {
    throw notFound('filing preparation');
  }

  const { portalKey, recipeFile } = await recipeTargetFor(prep);
  const recipe = await loadRecipe(portalKey, recipeFile);

  // Check worker capacity before creating any records.
  if (automationWorker.getActiveRunCount() >= 2) {
    throw conflict('Worker is at capacity. Please wait for an active run to finish.');
  }

  const run = await AutomationRun.create({
    client: prep.client,
    complianceItem: prep.complianceItem,
    filingPreparation: prep._id,
    portal: recipe.portal,
    form: recipe.form,
    mode: input.mode ?? 'recipe',
    status: 'queued',
    recipeVersion: recipe.version,
    initiatedBy: input.actor.id ?? input.user.id,
    actorRole: input.actor.role,
    steps: recipe.steps.map((s) => ({
      key: s.key,
      label: s.label ?? s.key,
      status: 'pending' as const,
    })),
  });

  await recordAudit({
    actor: input.actor,
    action: 'automation_start',
    entityKind: 'automationRun',
    entityId: run._id,
    client: prep.client,
    summary: `Started automation run for ${recipe.form} on ${recipe.portal}`,
  });

  // Start the browser worker in the background; failures are logged and
  // recorded on the run document by the worker itself.
  automationWorker
    .startRun({
      runId: run._id.toString(),
      clientId: prep.client.toString(),
      filingPreparationId: prep._id.toString(),
      recipe,
      portalPayload: prep.portalPayload ?? {},
      computed: prep.computed,
      mode: run.mode,
    })
    .catch((err) => {
      logger.error({ event: 'automation.start_failed', err }, 'failed to start worker run');
    });

  return run;
};

// ---------------------------------------------------------------------------
// Run lifecycle helpers (agent + REST shared)
// ---------------------------------------------------------------------------

const ACTIVE_RUN_STATUSES = ['queued', 'starting', 'running', 'waiting_human'] as const;

/** Scope check: run's client must be inside the user's accessible set. */
const assertRunScope = async (
  run: AutomationRunDocument,
  user: AuthenticatedUser,
): Promise<void> => {
  const scoped = await accessibleClientIds(user);
  if (scoped !== null && !scoped.some((id) => id.toString() === run.client.toString())) {
    throw notFound('automation run');
  }
};

/** Get a single run (scope-checked) by id. */
export const getRunForUser = async (
  runId: string | Types.ObjectId,
  user: AuthenticatedUser,
): Promise<AutomationRunDocument> => {
  const run = await AutomationRun.findById(runId).exec();
  if (!run) throw notFound('automation run');
  await assertRunScope(run, user);
  return run;
};

export interface ListRunsQuery {
  clientId?: string | Types.ObjectId | null;
  status?: string | null;
  limit?: number | null;
}

const ALL_RUN_STATUSES = [
  'queued',
  'starting',
  'running',
  'waiting_human',
  'succeeded',
  'failed',
  'aborted',
] as const;

/** List runs, client-scoped, newest first. */
export const listRunsForUser = async (
  user: AuthenticatedUser,
  query: ListRunsQuery = {},
): Promise<AutomationRunDocument[]> => {
  const scoped = await accessibleClientIds(user);
  let clientFilter: Record<string, unknown> = {};
  if (scoped !== null) {
    clientFilter = { client: { $in: scoped } };
  }
  if (query.clientId !== undefined && query.clientId !== null) {
    const requested = query.clientId.toString();
    if (scoped !== null && !scoped.some((id) => id.toString() === requested)) {
      throw notFound('automation run');
    }
    clientFilter = { client: requested };
  }

  const statusFilter: AutomationRunStatus | undefined =
    query.status !== undefined &&
    query.status !== null &&
    (ALL_RUN_STATUSES as readonly string[]).includes(query.status)
      ? (query.status as AutomationRunStatus)
      : undefined;

  const limit =
    typeof query.limit === 'number' && Number.isFinite(query.limit)
      ? Math.min(Math.max(Math.trunc(query.limit), 1), 50)
      : 20;

  return await AutomationRun.find({
    ...clientFilter,
    ...(statusFilter !== undefined ? { status: statusFilter } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
};

/** Abort a run (agent-safe: aborts are never destructive — they prevent action). */
export const abortRunForUser = async (
  runId: string | Types.ObjectId,
  user: AuthenticatedUser,
  actor: RequestActor,
): Promise<void> => {
  const run = await getRunForUser(runId, user);
  if (['succeeded', 'failed', 'aborted'].includes(run.status)) {
    throw conflict(`Run is already ${run.status}`);
  }
  await automationWorker.abortRun(run._id.toString());
  await recordAudit({
    actor,
    action: 'automation_abort',
    entityKind: 'automationRun',
    entityId: run._id,
    client: run.client,
    summary: 'Aborted automation run',
  });
};

// ---------------------------------------------------------------------------
// Portal intelligence
// ---------------------------------------------------------------------------

export interface AutomationSupportView {
  supportedForms: Array<{ form: string; portal: string; recipeVersion: number }>;
  knownForms: Array<{ formCode: string; portalKey: string; supported: boolean }>;
  activeCapacity: number;
  maxCapacity: number;
}

// formCode → the portal category it belongs to
const FORM_CATEGORY: Record<string, string> = {
  GSTR1: 'gst',
  GSTR3B: 'gst',
  GSTR9: 'gst',
  CMP08: 'gst',
  'ITR-IND': 'income_tax',
  'ITR-CO': 'income_tax',
  'ADV-TAX': 'income_tax',
  TDS24Q: 'tds',
  TDS26Q: 'tds',
  'ROC-MGT7': 'roc',
  'ROC-AOC4': 'roc',
};

/**
 * The agent's honest automation menu: which forms have recipes, which are
 * known but manual, and current worker capacity.
 */
export const getAutomationSupport = async (): Promise<AutomationSupportView> => {
  const recipes = await listRecipes();
  const supportedKeys = new Set(recipes.map((r) => `${r.portal}/${r.form}`));

  const knownForms = Object.entries(RECIPE_FILE_BY_FORM)
    .filter(([formCode]) => formCode !== 'FIXTURE')
    .map(([formCode, recipeFile]) => {
      const portalKey = FORM_CATEGORY[formCode] ?? 'gst';
      const supported = supportedKeys.has(`${portalKey}/${recipeFile}`);
      return { formCode, portalKey, supported };
    });

  return {
    supportedForms: recipes
      .filter((r) => r.portal !== 'demo' && r.form !== 'FIXTURE')
      .map((r) => ({ form: r.form, portal: r.portal, recipeVersion: r.version })),
    knownForms,
    activeCapacity: automationWorker.getActiveRunCount(),
    maxCapacity: 2,
  };
};

export interface AutomationMetricsView {
  total: number;
  succeeded: number;
  failed: number;
  aborted: number;
  active: number;
  successRate: number | null;
  avgDurationMs: number | null;
}

/** Aggregated health metrics over recent runs. */
export const getAutomationMetrics = async (
  user: AuthenticatedUser,
  days = 30,
): Promise<AutomationMetricsView> => {
  const scoped = await accessibleClientIds(user);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const base: Record<string, unknown> = { createdAt: { $gte: since } };
  if (scoped !== null) base.client = { $in: scoped };

  const runs = await AutomationRun.find(base).select('status finishedAt createdAt').exec();
  const total = runs.length;
  const succeeded = runs.filter((r) => r.status === 'succeeded').length;
  const failed = runs.filter((r) => r.status === 'failed').length;
  const aborted = runs.filter((r) => r.status === 'aborted').length;
  const active = runs.filter((r) =>
    (ACTIVE_RUN_STATUSES as readonly string[]).includes(r.status),
  ).length;

  const durations = runs
    .filter((r) => r.finishedAt !== null)
    .map((r) => (r.finishedAt as Date).getTime() - r.createdAt.getTime())
    .filter((ms) => Number.isFinite(ms) && ms >= 0);

  return {
    total,
    succeeded,
    failed,
    aborted,
    active,
    successRate: total > 0 ? Math.round((succeeded / total) * 100) : null,
    avgDurationMs:
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null,
  };
};

// ---------------------------------------------------------------------------
// Portal sessions (metadata only — secrets never leave the vault)
// ---------------------------------------------------------------------------

export interface PortalSessionView {
  clientId: string;
  portal: string;
  expiresAt: string;
  lastUsedAt: string;
}

/** List active sessions for a client (metadata only, no decrypted state). */
export const listPortalSessionsForUser = async (
  user: AuthenticatedUser,
  clientId: string | Types.ObjectId,
): Promise<PortalSessionView[]> => {
  const scoped = await accessibleClientIds(user);
  const idString = clientId.toString();
  if (scoped !== null && !scoped.some((id) => id.toString() === idString)) {
    throw notFound('client');
  }
  const sessions = await PortalSession.find({
    client: clientId,
    expiresAt: { $gt: new Date() },
  })
    .select('portal expiresAt lastUsedAt')
    .exec();
  return sessions.map((s) => ({
    clientId: idString,
    portal: s.portal,
    expiresAt: s.expiresAt.toISOString(),
    lastUsedAt: s.lastUsedAt.toISOString(),
  }));
};

/** Revoke a portal session for a client (security hygiene). */
export const revokePortalSessionForUser = async (
  user: AuthenticatedUser,
  actor: RequestActor,
  clientId: string | Types.ObjectId,
  portal: string,
): Promise<boolean> => {
  const scoped = await accessibleClientIds(user);
  const idString = clientId.toString();
  if (scoped !== null && !scoped.some((id) => id.toString() === idString)) {
    throw notFound('client');
  }
  const revoked = await revokeSession(clientId as Types.ObjectId, portal as never);
  if (revoked) {
    await recordAudit({
      actor,
      action: 'update',
      entityKind: 'client',
      entityId: clientId as Types.ObjectId,
      client: clientId as Types.ObjectId,
      summary: `Revoked ${portal} portal session`,
    });
  }
  return revoked;
};
