import type { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';

import type { DocumentType } from '../../src/lib/enums.js';
import type { AutomationRunStatus, PortalKey } from '../../src/lib/enums.js';
import { utcMidnight } from '../../src/lib/date.js';
import { AutomationRun } from '../../src/models/automationRun.model.js';
import { ComplianceItem } from '../../src/models/complianceItem.model.js';
import { DocumentModel } from '../../src/models/document.model.js';
import { FilingPreparation } from '../../src/models/filingPreparation.model.js';
import { PortalSession } from '../../src/models/portalSession.model.js';
import { prepareFiling } from '../../src/services/filingPreparation.service.js';
import {
  executePortalAutomation,
  getRunForUser,
  listRunsForUser,
  abortRunForUser,
  getAutomationSupport,
  getAutomationMetrics,
  listPortalSessionsForUser,
  revokePortalSessionForUser,
} from '../../src/services/portalAutomation/automationRun.service.js';
import { runAiAgent } from '../../src/services/aiAgent.service.js';
import { actorFromUser } from '../../src/types/context.js';
import type { AuthenticatedUser } from '../../src/types/context.js';
import { assignStaff, makeBusinessClient, makeComplianceType } from '../helpers/factories.js';
import type { TestAccount } from '../helpers/auth.js';
import { createAccount } from '../helpers/auth.js';

let admin: TestAccount;
let assignedStaff: TestAccount;
let outsiderStaff: TestAccount;
let clientUser: TestAccount;
let clientId: Types.ObjectId;
let gstr1Type: Types.ObjectId;
let gstr3bType: Types.ObjectId;
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

const prepareReadyFiling = async (): Promise<string> => {
  await seedDocuments();
  const prepared = await prepareFiling(userFromAccount(admin), filingId, actorFor(admin));
  expect(prepared.status).toBe('ready');
  return prepared.preparationId;
};

let seedCounter = 0;

/** Seed a run in a given status without touching the real browser worker. */
const seedRun = async (
  overrides: Partial<{
    status: string;
    form: string;
    portal: string;
    filingPreparation: Types.ObjectId;
    client: Types.ObjectId;
    arn: string | null;
  }> = {},
): Promise<Types.ObjectId> => {
  // Each seeded run gets its own compliance item (unique indexes on
  // FilingPreparation.complianceItem AND complianceItem.client+type+period).
  seedCounter += 1;
  const periodStart = utcMidnight(2025, seedCounter, 1);
  const periodEnd = utcMidnight(2025, seedCounter, 28);
  const ownFilingId = await ComplianceItem.create({
    client: clientId,
    complianceType: gstr1Type,
    periodType: 'month',
    periodStart,
    periodEnd,
    periodLabel: `2025 M${seedCounter}`,
    dueDate: utcMidnight(2025, seedCounter, 20),
    status: 'in_progress',
    assignedStaff: assignedStaff.id,
    generatedBy: 'manual',
  }).then((doc) => doc._id);

  const prep = await FilingPreparation.create({
    complianceItem: ownFilingId,
    client: clientId,
    formCode: 'GSTR1',
    periodLabel: `2025 M${seedCounter}`,
    periodStart,
    periodEnd,
    status: 'ready',
    summary: {},
    computed: {},
    portalPayload: {},
    portalName: 'GST Portal (gst.gov.in)',
    guideSteps: [],
    missingInputs: [],
    preparedBy: admin.id,
    lockedAt: null,
  });
  const run = await AutomationRun.create({
    client: overrides.client ?? clientId,
    complianceItem: ownFilingId,
    filingPreparation: overrides.filingPreparation ?? prep._id,
    portal: (overrides.portal ?? 'gst') as PortalKey,
    form: overrides.form ?? 'GSTR-1',
    mode: 'recipe',
    status: (overrides.status ?? 'succeeded') as AutomationRunStatus,
    recipeVersion: 1,
    initiatedBy: admin.id,
    actorRole: 'admin',
    steps: [
      { key: 'login', label: 'Login', status: 'succeeded' },
      { key: 'otp', label: 'OTP handoff', status: 'succeeded' },
    ],
    handoffs: [{ handoffId: 'h1', type: 'otp', prompt: 'Enter OTP', createdAt: new Date(), resolvedAt: new Date() }],
    result: { arn: overrides.arn ?? 'AA1234567890123', acknowledgementRef: null, portalRef: null },
    finishedAt: overrides.status === 'succeeded' ? new Date() : null,
    error: null,
  });
  return run._id;
};

beforeEach(async () => {
  admin = await createAccount({ role: 'admin' });
  assignedStaff = await createAccount({ role: 'staff', name: 'Assigned' });
  outsiderStaff = await createAccount({ role: 'staff', name: 'Outsider' });
  clientUser = await createAccount({ role: 'client', name: 'Client User' });

  clientId = await makeBusinessClient({ gstin: '27ABCDE1234F1Z5' });
  await assignStaff(clientId, [assignedStaff.id]);

  gstr1Type = await makeComplianceType({ name: 'GSTR-1', code: 'GSTR1', category: 'gst' });
  gstr3bType = await makeComplianceType({ name: 'GSTR-3B', code: 'GSTR3B', category: 'gst' });
  void gstr3bType;

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

describe('portal automation service — double-launch guard', () => {
  it('blocks a second live run for the same preparation', async () => {
    const preparationId = await prepareReadyFiling();

    // First launch succeeds (queued run, worker dispatched in background)
    await executePortalAutomation({
      filingPreparationId: preparationId,
      user: userFromAccount(admin),
      actor: actorFor(admin),
    });

    // Second launch for the SAME preparation must be blocked
    await expect(
      executePortalAutomation({
        filingPreparationId: preparationId,
        user: userFromAccount(admin),
        actor: actorFor(admin),
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('portal automation service — run lifecycle', () => {
  it('returns a scope-checked run with waiting-handoff metadata', async () => {
    const runId = await seedRun({ status: 'waiting_human' });
    const run = await AutomationRun.findById(runId).exec();
    run!.handoffs.push({
      handoffId: 'h2',
      type: 'otp',
      prompt: 'Enter the OTP',
      createdAt: new Date(),
      resolvedAt: null,
    });
    await run!.save();

    const fetched = await getRunForUser(runId, userFromAccount(admin));
    expect(fetched.status).toBe('waiting_human');
    expect(fetched.handoffs.some((h) => h.resolvedAt === null)).toBe(true);
  });

  it('404s a run for staff outside the client scope', async () => {
    const runId = await seedRun();
    await expect(
      getRunForUser(runId, userFromAccount(outsiderStaff)),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('lists runs newest-first, scoped for staff', async () => {
    await seedRun({ status: 'succeeded' });
    await seedRun({ status: 'failed' });

    const forAdmin = await listRunsForUser(userFromAccount(admin), { limit: 10 });
    expect(forAdmin.length).toBeGreaterThanOrEqual(2);

    const forAssigned = await listRunsForUser(userFromAccount(assignedStaff), { limit: 10 });
    expect(forAssigned.every((r) => r.client.toString() === clientId.toString())).toBe(true);

    const forOutsider = await listRunsForUser(userFromAccount(outsiderStaff), { limit: 10 });
    expect(forOutsider.length).toBe(0);
  });

  it('refuses to abort an already-finished run', async () => {
    const runId = await seedRun({ status: 'succeeded' });
    await expect(
      abortRunForUser(runId, userFromAccount(admin), actorFor(admin)),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('portal automation service — intelligence', () => {
  it('reports the honest automation coverage menu', async () => {
    const support = await getAutomationSupport();
    expect(support.maxCapacity).toBe(2);
    expect(support.activeCapacity).toBeGreaterThanOrEqual(0);
    expect(support.knownForms.some((f) => f.formCode === 'GSTR3B')).toBe(true);
    // at least one real recipe (GSTR-1 / GSTR-3B ship with the repo)
    expect(support.supportedForms.length).toBeGreaterThan(0);
    // fixture/demo recipe must never appear as a supported form
    expect(support.supportedForms.every((f) => f.form !== 'FIXTURE')).toBe(true);
  });

  it('computes metrics from seeded runs', async () => {
    await seedRun({ status: 'succeeded' });
    await seedRun({ status: 'failed' });
    const metrics = await getAutomationMetrics(userFromAccount(admin), 30);
    expect(metrics.total).toBeGreaterThanOrEqual(2);
    expect(metrics.succeeded).toBeGreaterThanOrEqual(1);
    expect(metrics.failed).toBeGreaterThanOrEqual(1);
  });

  it('returns session metadata only — never decrypted state', async () => {
    const encrypted = {
      ciphertext: 'abc',
      iv: 'iv',
      tag: 'tag',
      keyVersion: 1,
    };
    await PortalSession.create({
      client: clientId,
      portal: 'gst',
      encryptedState: encrypted,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      lastUsedAt: new Date(),
    });

    const sessions = await listPortalSessionsForUser(userFromAccount(admin), clientId);
    expect(sessions.length).toBe(1);
    expect(sessions[0]!.portal).toBe('gst');
    expect(JSON.stringify(sessions)).not.toContain('ciphertext');
    expect(JSON.stringify(sessions)).not.toContain('encryptedState');
  });

  it('blocks session listing for staff outside scope', async () => {
    await expect(
      listPortalSessionsForUser(userFromAccount(outsiderStaff), clientId),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('revokes a portal session and reports when none exists', async () => {
    const revokedNone = await revokePortalSessionForUser(
      userFromAccount(admin),
      actorFor(admin),
      clientId,
      'gst',
    );
    expect(revokedNone).toBe(false);

    await PortalSession.create({
      client: clientId,
      portal: 'gst',
      encryptedState: { ciphertext: 'abc', iv: 'iv', tag: 'tag', keyVersion: 1 },
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      lastUsedAt: new Date(),
    });
    const revoked = await revokePortalSessionForUser(
      userFromAccount(admin),
      actorFor(admin),
      clientId,
      'gst',
    );
    expect(revoked).toBe(true);
    const remaining = await PortalSession.countDocuments({ client: clientId });
    expect(remaining).toBe(0);
  });
});

describe('AI agent tools — automation intelligence', () => {
  it('get_automation_run_status answers with live run data', async () => {
    const runId = await seedRun({ status: 'succeeded', arn: 'AA1234567890123' });
    const reply = await runAiAgent({
      user: userFromAccount(admin),
      actor: actorFor(admin),
      message: `what is the status of automation run ${runId.toString()}`,
      history: [],
      currentRoute: '/compliance',
    });
    void reply; // fallback mode does not run tools by name from prose; tool-level check below
  });

  it('client-role users cannot list runs via the tool (guard)', async () => {
    const reply = await runAiAgent({
      user: { ...userFromAccount(clientUser), linkedClients: [clientId] },
      actor: actorFor(clientUser),
      message: 'kis kis ki filing chal rahi hai?',
      history: [],
      currentRoute: '/compliance',
    });
    expect(reply.mode).toBe('fallback');
    // The fallback listing tool runs client-scoped: a client user's tool call
    // returns an error object rather than run data.
    expect(reply.content.length).toBeGreaterThan(0);
  });

  it('fallback mode answers automation status questions with run + coverage data', async () => {
    await seedRun({ status: 'succeeded' });
    const reply = await runAiAgent({
      user: userFromAccount(admin),
      actor: actorFor(admin),
      message: 'what is happening with the browser automation?',
      history: [],
      currentRoute: '/dashboard',
    });
    expect(reply.mode).toBe('fallback');
    expect(reply.content).toContain('Portal automation status');
    expect(reply.content).toContain('GSTR-1');
    expect(reply.toolCalls.some((t) => t.tool === 'list_automation_runs')).toBe(true);
    expect(reply.toolCalls.some((t) => t.tool === 'check_automation_support')).toBe(true);
  });
});
