import { Router } from 'express';

import * as controller from '../controllers/portal.controller.js';
import { mutationLimiter, readLimiter, revealLimiter } from '../middleware/rateLimit.js';
import { requireClientScope } from '../middleware/requireClientScope.js';
import { requireCapability } from '../middleware/requireRole.js';
import { handle } from '../middleware/validate.js';
import { pageQuery } from '../validators/common.validators.js';
import { portalOnboardingBody, portalProfileBody } from '../validators/client.validators.js';
import { portalComplianceQuery } from '../validators/compliance.validators.js';
import { documentRequestListQuery } from '../validators/documentRequest.validators.js';

export const portalRouter: Router = Router();

const activeClient = requireClientScope('header');

portalRouter.post(
  '/onboarding',
  mutationLimiter,
  requireCapability('portal:write', { allowUnlinked: true }),
  handle({ body: portalOnboardingBody }, controller.submitOnboarding),
);

portalRouter.get(
  '/clients',
  readLimiter,
  requireCapability('portal:read'),
  handle({}, controller.listLinkedClients),
);

portalRouter.get(
  '/overview',
  readLimiter,
  requireCapability('portal:read'),
  activeClient,
  handle({}, controller.overview),
);

portalRouter.get(
  '/compliance',
  readLimiter,
  requireCapability('portal:read'),
  activeClient,
  handle({ query: portalComplianceQuery }, controller.compliance),
);

portalRouter.get(
  '/tasks',
  readLimiter,
  requireCapability('portal:read'),
  activeClient,
  handle({ query: pageQuery }, controller.tasks),
);

portalRouter.get(
  '/requests',
  readLimiter,
  requireCapability('portal:read'),
  activeClient,
  handle({ query: documentRequestListQuery }, controller.requests),
);

portalRouter.get(
  '/activity',
  readLimiter,
  requireCapability('portal:read'),
  activeClient,
  handle({ query: pageQuery }, controller.activity),
);

portalRouter.get(
  '/profile',
  readLimiter,
  requireCapability('portal:read'),
  activeClient,
  handle({}, controller.profile),
);

portalRouter.patch(
  '/profile',
  mutationLimiter,
  requireCapability('portal:write'),
  activeClient,
  handle(
    {
      body: portalProfileBody,
      rejectBodyKeys: [
        'pan',
        'gstin',
        'tan',
        'cin',
        'aadhaar',
        'clientType',
        'status',
        'assignedStaff',
        'archived',
        'notes',
      ],
    },
    controller.updateProfile,
  ),
);

portalRouter.get(
  '/aadhaar',
  revealLimiter,
  requireCapability('portal:read'),
  activeClient,
  handle({}, controller.aadhaar),
);

// ---------------------------------------------------------------------------
// Automation Fixture Routes (for local testing without real portals)
// ---------------------------------------------------------------------------

portalRouter.get('/fixture/login', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Mock Portal Login</title></head>
      <body>
        <h1>Login</h1>
        <input type="password" id="password-input" placeholder="Password" />
        <button id="login-btn" onclick="window.location.href='/api/v1/portal/fixture/form'">Login</button>
      </body>
    </html>
  `);
});

portalRouter.get('/fixture/form', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Mock Form</title></head>
      <body>
        <h1>Form</h1>
        <input type="text" id="taxable-value" placeholder="Taxable Value" />
        <button id="file-btn" onclick="window.location.href='/api/v1/portal/fixture/success'">FILE</button>
      </body>
    </html>
  `);
});

portalRouter.get('/fixture/success', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Mock Success</title></head>
      <body>
        <h1>Success</h1>
        <p>Your return has been filed.</p>
        <div>ARN: AA2707231234567</div>
      </body>
    </html>
  `);
});
