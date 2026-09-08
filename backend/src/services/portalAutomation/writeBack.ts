// ---------------------------------------------------------------------------
// Write-back — updates ComplianceItem + FilingPreparation on successful filing
//
// Reuses the existing governmentGateway marking logic:
//   ComplianceItem → status='filed', filedDate, acknowledgementRef
//   FilingPreparation → locked
//   Audit log entry with run + evidence references
// ---------------------------------------------------------------------------

import { Types } from 'mongoose';

import { logger } from '../../config/logger.js';
import { ComplianceItem } from '../../models/complianceItem.model.js';
import { notFound } from '../../lib/errors.js';
import { lockPreparation } from '../filingPreparation.service.js';
import { recordAudit } from '../audit.service.js';
import type { AuthenticatedUser, RequestActor } from '../../types/context.js';
import type { AutomationRunResult } from '../../models/automationRun.model.js';

/**
 * Write the filing result back to ComplianceItem and lock the preparation.
 * Mirrors governmentGateway.service.ts submitReturnWithOtp write-back path.
 */
export const writeBackResult = async (
  user: AuthenticatedUser,
  filingId: Types.ObjectId,
  runId: string,
  result: AutomationRunResult,
  actor: RequestActor,
): Promise<void> => {
  const arn = result.arn ?? result.acknowledgementRef ?? result.portalRef;
  if (!arn) {
    logger.warn(
      { event: 'writeback.no_arn', runId, filingId: filingId.toString() },
      'automation run succeeded but no ARN/reference was extracted — skipping write-back',
    );
    return;
  }

  const filing = await ComplianceItem.findById(filingId).exec();
  if (!filing) throw notFound('filing');

  // Mark compliance item as filed with the real ARN
  filing.status = 'filed';
  filing.filedDate = new Date();
  filing.acknowledgementRef = arn;
  filing.set('updatedBy', actor.id);
  await filing.save();

  // Lock the preparation to freeze figures
  await lockPreparation(user, filingId, actor);

  // Audit trail with automation context
  await recordAudit({
    actor,
    action: 'status_change',
    entityKind: 'complianceItem',
    entityId: filingId,
    client: filing.client,
    summary: `Return filed via Portal Pilot automation (run ${runId}). ARN: ${arn}`,
  });

  logger.info(
    { event: 'writeback.success', runId, filingId: filingId.toString(), arn },
    'automation result written back to compliance item',
  );
};
