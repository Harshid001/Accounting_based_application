import { Router } from 'express';

import * as controller from '../controllers/desktop.controller.js';
import { mutationLimiter, readLimiter } from '../middleware/rateLimit.js';
import { requireClientScope } from '../middleware/requireClientScope.js';
import { requireCapability } from '../middleware/requireRole.js';
import { handle } from '../middleware/validate.js';
import { idParam } from '../validators/common.validators.js';
import {
  importTallyAccountsBody,
  postToTallyBody,
  tallyStatusQuery,
  workstationCommandsQuery,
  workstationListQuery,
  workstationPingBody,
  workstationRegisterBody,
  workstationResultBody,
} from '../validators/desktop.validators.js';

export const booksTallyRouter: Router = Router();

// --- staff-facing Tally bridge (under /books/tally) -------------------------

booksTallyRouter.get(
  '/status',
  readLimiter,
  requireCapability('books:tally'),
  requireClientScope('query:client'),
  handle({ query: tallyStatusQuery }, controller.tallyStatus),
);

booksTallyRouter.get(
  '/health',
  readLimiter,
  requireCapability('books:tally'),
  requireClientScope('query:client'),
  handle({ query: tallyStatusQuery }, controller.tallyHealth),
);

booksTallyRouter.post(
  '/post',
  mutationLimiter,
  requireCapability('books:tally'),
  requireClientScope('body:clientId'),
  handle({ body: postToTallyBody }, controller.tallyPost),
);

booksTallyRouter.post(
  '/import-accounts',
  mutationLimiter,
  requireCapability('books:tally'),
  requireClientScope('body:clientId'),
  handle({ body: importTallyAccountsBody }, controller.tallyImport),
);

export const desktopRouter: Router = Router();

// --- desktop app (auth'd; no client scope — commands carry their own) -------

desktopRouter.post(
  '/workstation/register',
  mutationLimiter,
  requireCapability('desktop:workstation'),
  handle({ body: workstationRegisterBody }, controller.workstationRegister),
);

desktopRouter.post(
  '/workstation/ping',
  mutationLimiter,
  requireCapability('desktop:workstation'),
  handle({ body: workstationPingBody }, controller.workstationPing),
);

desktopRouter.get(
  '/workstation/commands',
  readLimiter,
  requireCapability('desktop:workstation'),
  handle({ query: workstationCommandsQuery }, controller.workstationCommands),
);

desktopRouter.post(
  '/workstation/results',
  mutationLimiter,
  requireCapability('desktop:workstation'),
  handle({ body: workstationResultBody }, controller.workstationResult),
);

// --- admin management ---------------------------------------------------------

desktopRouter.get(
  '/workstations',
  readLimiter,
  requireCapability('user:manage'),
  handle({ query: workstationListQuery }, controller.workstationsList),
);

desktopRouter.delete(
  '/workstations/:id',
  mutationLimiter,
  requireCapability('user:manage'),
  handle({ params: idParam }, controller.workstationRevoke),
);
