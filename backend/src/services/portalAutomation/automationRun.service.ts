import { Types } from 'mongoose';

import { logger } from '../../config/logger.js';
import { conflict, notFound } from '../../lib/errors.js';
import type { AutomationRunMode } from '../../lib/enums.js';
import { accessibleClientIds } from '../compliance.service.js';
import { ComplianceItem } from '../../models/complianceItem.model.js';
import { ComplianceType } from '../../models/complianceType.model.js';
import { AutomationRun } from '../../models/automationRun.model.js';
import type { AutomationRunDocument } from '../../models/automationRun.model.js';
import { FilingPreparation } from '../../models/filingPreparation.model.js';
import { recordAudit } from '../audit.service.js';
import type { AuthenticatedUser, RequestActor } from '../../types/context.js';
import { loadRecipe } from './recipeEngine.js';
import { automationWorker } from './worker.js';

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
