import request from 'supertest';
import type { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';

import type { DocumentType } from '../../src/lib/enums.js';
import { utcMidnight } from '../../src/lib/date.js';
import { AutomationRun } from '../../src/models/automationRun.model.js';
import { ComplianceItem } from '../../src/models/complianceItem.model.js';
import { DocumentModel } from '../../src/models/document.model.js';
import { FilingPreparation } from '../../src/models/filingPreparation.model.js';
import { prepareFiling } from '../../src/services/filingPreparation.service.js';
import { executePortalAutomation } from '../../src/services/portalAutomation/automationRun.service.js';
import { assignStaff, makeBusinessClient, makeComplianceType } from '../helpers/factories.js';
import type { TestAccount } from '../helpers/auth.js';
import { app, auth, createAccount } from '../helpers/auth.js';
import { actorFromUser } from '../../src/types/context.js';
import type { AuthenticatedUser } from '../../src/types/context.js';

let admin: TestAccount;
let assignedStaff: TestAccount;
let outsiderStaff: TestAccount;
let clientId: Types.ObjectId;
let gstr1Type: Types.ObjectId;
let filingId: Types.ObjectId;

const userFromAccount = (account: TestAccount): AuthenticatedUser => ({
  id: account.id,
  name: account.name,
  email: account.email,
  emailVerified: true,
  role: account.role,
  status: 'active',
  linkedClients: [],
  pinnedClients: [],
  notificationPreferences: {
    emailOnAssignment: true,
    emailDeadlineReminders: true,
    emailDailyDigest: true,
  },
});

const actorFor = (account: TestAccount) =>
  actorFromUser(userFromAccount(account), null, null, null);

const seedDocuments = async (): Promise<void> => {
  const types: DocumentType[] = ['sales_invoice', 'purchase_invoice', 'bank_statement'];
  for (const documentType of types) {
    await DocumentModel.create({
      client: clientId,
      title: `Doc ${documentType}`,
      documentType,
      complianceItem: filingId,
      versions: [
        {
          version: 1,
          storageKey: `clients/${clientId.toString()}/${Math.random().toString(36).slice(2)}.pdf`,
          originalFilename: 'file.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          uploadedBy: admin.id,
          uploadedAt: new Date(),
        },
      ],
      currentVersion: 1,
      uploadedByRole: 'staff',
      createdBy: admin.id,
    });
  }
};

/** A filing with a `ready` preparation — the precondition for a portal run. */
const prepareReadyFiling = async (): Promise<string> => {
  await seedDocuments();
  const prepared = await prepareFiling(userFromAccount(admin), filingId, actorFor(admin));
  expect(prepared.status).toBe('ready');
  return prepared.preparationId;
};

const makeDraftPreparation = async (): Promise<string> => {
  const doc = await FilingPreparation.create({
    complianceItem: filingId,
    client: clientId,
    formCode: 'GSTR1',
    periodLabel: 'Jun 2026',
    periodStart: utcMidnight(2026, 6, 1),
    periodEnd: utcMidnight(2026, 6, 30),
    status: 'draft',
    summary: {},
    computed: {},
    portalPayload: null,
    portalName: 'GST Portal (gst.gov.in)',
    guideSteps: [],
    missingInputs: ['Sales invoices (B2B + B2C) for the period'],
    preparedBy: admin.id,
    lockedAt: null,
  });
  return doc._id.toString();
};

beforeEach(async () => {
  admin = await createAccount({ role: 'admin' });
  assignedStaff = await createAccount({ role: 'staff', name: 'Assigned' });
  outsiderStaff = await createAccount({ role: 'staff', name: 'Outsider' });

  clientId = await makeBusinessClient({ gstin: '27ABCDE1234F1Z5' });
  await assignStaff(clientId, [assignedStaff.id]);

  gstr1Type = await makeComplianceType({
    name: 'GSTR-1',
    code: 'GSTR1',
    category: 'gst',
  });

  filingId = await ComplianceItem.create({
    client: clientId,
    complianceType: gstr1Type,
    periodType: 'month',
    periodStart: utcMidnight(2026, 6, 1),
    periodEnd: utcMidnight(2026, 6, 30),
    periodLabel: 'Jun 2026',
    dueDate: utcMidnight(2026, 7, 11),
    status: 'in_progress',
    assignedStaff: assignedStaff.id,
    generatedBy: 'manual',
  }).then((doc) => doc._id);
});

describe('executePortalAutomation service', () => {
  it('creates a queued run for a ready preparation', async () => {
    const preparationId = await prepareReadyFiling();

    const run = await executePortalAutomation({
      filingPreparationId: preparationId,
      user: userFromAccount(admin),
      actor: actorFor(admin),
    });

    expect(run.status).toBe('queued');
    expect(run.form).toBe('GSTR-1');
    expect(run.portal).toBe('gst');
    expect(run.filingPreparation.toString()).toBe(preparationId);
    expect(run.steps.length).toBeGreaterThan(0);
    expect(run.steps[0]?.status).toBe('pending');
  });

  it('rejects a preparation that is still a draft', async () => {
    const draftPrepId = await makeDraftPreparation();

    await expect(
      executePortalAutomation({
        filingPreparationId: draftPrepId,
        user: userFromAccount(admin),
        actor: actorFor(admin),
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('blocks staff outside the client scope', async () => {
    const preparationId = await prepareReadyFiling();

    await expect(
      executePortalAutomation({
        filingPreparationId: preparationId,
        user: userFromAccount(outsiderStaff),
        actor: actorFor(outsiderStaff),
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('404s for an unknown preparation id', async () => {
    await expect(
      executePortalAutomation({
        filingPreparationId: '0123456789abcdef01234567',
        user: userFromAccount(admin),
        actor: actorFor(admin),
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('POST /api/v1/automation/runs (start run)', () => {
  it('starts a run via the REST endpoint using the shared service', async () => {
    const preparationId = await prepareReadyFiling();

    const response = await request(app())
      .post('/api/v1/automation/runs')
      .set(auth(admin))
      .send({ filingPreparationId: preparationId });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('queued');
    expect(response.body.data.form).toBe('GSTR-1');
    expect(response.body.data.complianceItemId).toBe(filingId.toString());

    const runs = await AutomationRun.find({ filingPreparation: preparationId }).exec();
    expect(runs.length).toBeGreaterThan(0);
  });

  it('rejects a run for a draft preparation with 409', async () => {
    const draftPrepId = await makeDraftPreparation();

    const response = await request(app())
      .post('/api/v1/automation/runs')
      .set(auth(admin))
      .send({ filingPreparationId: draftPrepId });

    expect(response.status).toBe(409);
  });
});
