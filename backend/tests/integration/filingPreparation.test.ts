import request from 'supertest';
import type { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';

import type { DocumentType } from '../../src/lib/enums.js';
import { utcMidnight } from '../../src/lib/date.js';
import { DocumentModel } from '../../src/models/document.model.js';
import { FilingPreparation } from '../../src/models/filingPreparation.model.js';
import { assignStaff, makeBusinessClient, makeComplianceType } from '../helpers/factories.js';
import { ComplianceItem } from '../../src/models/complianceItem.model.js';
import type { TestAccount } from '../helpers/auth.js';
import { app, auth, createAccount } from '../helpers/auth.js';

let admin: TestAccount;
let assignedStaff: TestAccount;
let outsider: TestAccount;
let clientId: Types.ObjectId;
let gstr3bType: Types.ObjectId;
let filingId: Types.ObjectId;

const makeFilingDocument = async (
  documentType: DocumentType,
): Promise<void> => {
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
};

beforeEach(async () => {
  admin = await createAccount({ role: 'admin' });
  assignedStaff = await createAccount({ role: 'staff', name: 'Assigned' });
  outsider = await createAccount({ role: 'staff', name: 'Outsider' });

  clientId = await makeBusinessClient({ gstin: '27ABCDE1234F1Z5' });
  await assignStaff(clientId, [assignedStaff.id]);

  gstr3bType = await makeComplianceType({
    name: 'GSTR-3B',
    code: 'GSTR3B',
    category: 'gst',
  });

  filingId = await ComplianceItem.create({
    client: clientId,
    complianceType: gstr3bType,
    periodType: 'month',
    periodStart: utcMidnight(2026, 6, 1),
    periodEnd: utcMidnight(2026, 6, 30),
    periodLabel: 'Jun 2026',
    dueDate: utcMidnight(2026, 7, 20),
    status: 'in_progress',
    assignedStaff: assignedStaff.id,
    generatedBy: 'manual',
  }).then((doc) => doc._id);
});

describe('filing preparation', () => {
  it('rejects preparation for an unsupported compliance type', async () => {
    const advisoryType = await makeComplianceType({
      name: 'Advisory Retainer',
      code: 'ADVISORY',
      category: 'advisory',
    });
    const advisoryFiling = await ComplianceItem.create({
      client: clientId,
      complianceType: advisoryType,
      periodType: 'month',
      periodStart: utcMidnight(2026, 6, 1),
      periodEnd: utcMidnight(2026, 6, 30),
      periodLabel: 'Jun 2026',
      dueDate: utcMidnight(2026, 7, 20),
      status: 'pending',
      generatedBy: 'manual',
    }).then((doc) => doc._id);

    const response = await request(app())
      .post(`/api/v1/filing-preparations/${advisoryFiling.toString()}/prepare`)
      .set(auth(admin))
      .send();
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('blocks staff outside the client scope', async () => {
    const response = await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/prepare`)
      .set(auth(outsider))
      .send();
    expect(response.status).toBe(404);
  });

  it('prepares a GSTR-3B with missing inputs and a guide', async () => {
    const response = await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/prepare`)
      .set(auth(assignedStaff))
      .send();
    expect(response.status).toBe(200);

    const data = response.body.data;
    expect(data.formCode).toBe('GSTR3B');
    expect(data.status).toBe('draft');
    expect(data.missingInputs.length).toBeGreaterThan(0);
    expect(data.guideSteps.length).toBe(5);
    expect(data.portalName).toContain('GST');
    expect(data.portalUrl).toContain('gst.gov.in');
    expect(data.summary.netTaxPayable).toBe(0);
  });

  it('marks the preparation ready when every input is present', async () => {
    await makeFilingDocument('sales_invoice');
    await makeFilingDocument('sales_invoice');
    await makeFilingDocument('purchase_invoice');
    await makeFilingDocument('bank_statement');

    const response = await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/prepare`)
      .set(auth(assignedStaff))
      .send();
    expect(response.status).toBe(200);

    const data = response.body.data;
    expect(data.status).toBe('ready');
    expect(data.missingInputs).toEqual([]);
    expect(data.summary.outwardTaxableValue).toBe(250000);
    expect(data.summary.outputTax).toBe(45000);
    expect(data.summary.inputTaxCredit).toBe(14400);
    expect(data.summary.netTaxPayable).toBe(30600);
    expect(data.guideSteps[4].title).toContain('ARN');
  });

  it('404s the guide before any preparation exists', async () => {
    const response = await request(app())
      .get(`/api/v1/filing-preparations/${filingId.toString()}`)
      .set(auth(assignedStaff))
      .send();
    expect(response.status).toBe(404);
  });

  it('toggles guide steps and refuses out-of-range indexes', async () => {
    await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/prepare`)
      .set(auth(admin))
      .send();

    const toggle = await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/guide-step`)
      .set(auth(assignedStaff))
      .send({ stepIndex: 0, done: true });
    expect(toggle.status).toBe(200);
    expect(toggle.body.data.guideSteps[0].done).toBe(true);

    const invalid = await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/guide-step`)
      .set(auth(assignedStaff))
      .send({ stepIndex: 99, done: true });
    expect(invalid.status).toBe(400);
  });

  it('locks a ready preparation and then freezes step updates', async () => {
    await makeFilingDocument('sales_invoice');
    await makeFilingDocument('purchase_invoice');
    await makeFilingDocument('bank_statement');

    await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/prepare`)
      .set(auth(assignedStaff))
      .send();

    const lock = await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/lock`)
      .set(auth(assignedStaff))
      .send();
    expect(lock.status).toBe(200);
    expect(lock.body.data.status).toBe('locked');
    expect(lock.body.data.lockedAt).not.toBeNull();

    const frozen = await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/guide-step`)
      .set(auth(assignedStaff))
      .send({ stepIndex: 0, done: true });
    expect(frozen.status).toBe(409);

    const stored = await FilingPreparation.findOne({ complianceItem: filingId }).lean();
    expect(stored?.status).toBe('locked');
  });

  it('downloads the prepared return payload as a json file attachment', async () => {
    await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/prepare`)
      .set(auth(assignedStaff))
      .send();

    const response = await request(app())
      .get(`/api/v1/filing-preparations/${filingId.toString()}/download`)
      .set(auth(assignedStaff))
      .send();

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.headers['content-disposition']).toMatch(/attachment;\s*filename="GSTR3B_.*\.json"/);
    expect(response.body).toHaveProperty('form', 'GSTR3B');
  });
});

