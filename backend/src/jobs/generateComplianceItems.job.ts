import { systemActor } from '../types/context.js';
import { runRollingGeneration } from '../services/complianceGenerator.service.js';
import { runWithLock } from './lock.js';
import type { JobOutcome } from './lock.js';

export const generateComplianceItems = async (): Promise<JobOutcome> =>
  runWithLock('generateComplianceItems', async () => {
    const result = await runRollingGeneration(systemActor());
    return {
      created: result.created,
      skipped: result.skipped,
      requestsCreated: result.requestsCreated,
    };
  });
