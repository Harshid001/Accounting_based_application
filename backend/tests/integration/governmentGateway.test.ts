import type { Types } from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { utcMidnight } from '../../src/lib/date.js';
import type { DocumentType } from '../../src/lib/enums.js';
import { ComplianceItem } from '../../src/models/complianceItem.model.js';
import { DocumentModel } from '../../src/models/document.model.js';
import { FilingPreparation } from '../../src/models/filingPreparation.model.js';
import type { TestAccount } from '../helpers/auth.js';
import { app, auth, createAccount } from '../helpers/auth.js';
import { assignStaff, makeBusinessClient, makeComplianceType } from '../helpers/factories.js';

let admin: TestAccount;
let assignedStaff: TestAccount;
let outsider: TestAccount;
let clientId: Types.ObjectId;
let gstr3bType: Types.ObjectId;
let filingId: Types.ObjectId;

const makeFilingDocument = async (documentType: DocumentType): Promise<void> => {
  await DocumentModel.create({
    client: clientId,
    title: `Doc ${documentType}`,
    documentType,
    complianceItem: filingId,
    versions: [
      {
        version: 1,
        storageKey: `clients/${clientId.toString()}/${Math.random().toString(36).slice(2)}.pdf`,
        originalFilename: 'test.pdf',
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

  const filing = await ComplianceItem.create({
    client: clientId,
    complianceType: gstr3bType,
    periodType: 'month',
    periodStart: utcMidnight(2026, 6, 1),
    periodEnd: utcMidnight(2026, 6, 30),
    periodLabel: 'Jun 2026',
    dueDate: utcMidnight(2026, 7, 20),
    status: 'pending',
    assignedStaff: assignedStaff.id,
  });
  filingId = filing._id;
});

describe('Government API Gateway - Direct Return Filing', () => {
  it('rejects OTP request when required document inputs are missing', async () => {
    // Only prepare with 0 documents -> missing inputs present
    await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/prepare`)
      .set(auth(assignedStaff))
      .send();

    const response = await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/gateway/request-otp`)
      .set(auth(assignedStaff))
      .send();

    expect(response.status).toBe(409);
    expect(response.body.error.message).toContain('missing');
  });

  it('generates an OTP challenge for a ready preparation with masked contact info', async () => {
    await makeFilingDocument('sales_invoice');
    await makeFilingDocument('purchase_invoice');
    await makeFilingDocument('bank_statement');

    await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/prepare`)
      .set(auth(assignedStaff))
      .send();

    const response = await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/gateway/request-otp`)
      .set(auth(assignedStaff))
      .send();

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty('transactionId');
    expect(response.body.data).toHaveProperty('maskedTarget');
    expect(response.body.data.expiresInSeconds).toBe(600);
  });

  it('rejects invalid OTP submission with 400 validation error', async () => {
    await makeFilingDocument('sales_invoice');
    await makeFilingDocument('purchase_invoice');
    await makeFilingDocument('bank_statement');

    await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/prepare`)
      .set(auth(assignedStaff))
      .send();

    const response = await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/gateway/submit`)
      .set(auth(assignedStaff))
      .send({ otp: '000000' });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('rejected the OTP');
  });

  it('submits return with valid OTP and updates filing status to filed with official ARN', async () => {
    await makeFilingDocument('sales_invoice');
    await makeFilingDocument('purchase_invoice');
    await makeFilingDocument('bank_statement');

    await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/prepare`)
      .set(auth(assignedStaff))
      .send();

    const otpRes = await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/gateway/request-otp`)
      .set(auth(assignedStaff))
      .send();

    expect(otpRes.status).toBe(200);

    const submitRes = await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/gateway/submit`)
      .set(auth(assignedStaff))
      .send({ otp: '123456', transactionId: otpRes.body.data.transactionId });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.success).toBe(true);
    expect(submitRes.body.data.status).toBe('filed');
    // GST ARN format check: AA + 27 + MMYY + 7 digits
    expect(submitRes.body.data.arn).toMatch(/^AA27\d{4}\d{7}$/);

    // Verify compliance item updated in database
    const item = await ComplianceItem.findById(filingId).lean().exec();
    expect(item?.status).toBe('filed');
    expect(item?.acknowledgementRef).toBe(submitRes.body.data.arn);
    expect(item?.filedDate).not.toBeNull();

    // Verify preparation is locked
    const prep = await FilingPreparation.findOne({ complianceItem: filingId }).lean().exec();
    expect(prep?.status).toBe('locked');
  });

  it('blocks staff not assigned to client from requesting OTP or submitting', async () => {
    await makeFilingDocument('sales_invoice');
    await makeFilingDocument('purchase_invoice');
    await makeFilingDocument('bank_statement');

    await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/prepare`)
      .set(auth(admin))
      .send();

    const outsideOtp = await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/gateway/request-otp`)
      .set(auth(outsider))
      .send();
    expect(outsideOtp.status).toBe(404);

    const outsideSubmit = await request(app())
      .post(`/api/v1/filing-preparations/${filingId.toString()}/gateway/submit`)
      .set(auth(outsider))
      .send({ otp: '123456' });
    expect(outsideSubmit.status).toBe(404);
  });
});
