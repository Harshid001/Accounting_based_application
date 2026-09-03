import request from 'supertest';
import type { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  assignStaff,
  makeClient,
  makeComplianceItem,
  makeComplianceType,
  makeDocument,
  makeTask,
} from '../helpers/factories.js';
import type { TestAccount } from '../helpers/auth.js';
import { app, auth, authWithClient, createAccount, linkClients } from '../helpers/auth.js';

let meena: TestAccount;
let anil: TestAccount;
let staff: TestAccount;
let meenaClient: Types.ObjectId;
let anilPersonal: Types.ObjectId;
let anilCompany: Types.ObjectId;
let typeId: Types.ObjectId;

beforeEach(async () => {
  meena = await createAccount({ role: 'client', name: 'Meena' });
  anil = await createAccount({ role: 'client', name: 'Anil' });
  staff = await createAccount({ role: 'staff', name: 'Rahul' });

  meenaClient = await makeClient({ displayName: 'Meena Trading' });
  anilPersonal = await makeClient({ displayName: 'Anil Personal' });
  anilCompany = await makeClient({ displayName: 'Anil Ventures' });

  await linkClients(meena, [meenaClient]);
  await linkClients(anil, [anilPersonal, anilCompany]);
  await assignStaff(meenaClient, [staff.id]);
  typeId = await makeComplianceType();
});

describe('the active client header', () => {
  it('is required on every scoped portal route', async () => {
    for (const path of [
      '/api/v1/portal/overview',
      '/api/v1/portal/compliance',
      '/api/v1/portal/tasks',
      '/api/v1/portal/requests',
      '/api/v1/portal/profile',
    ]) {
      const response = await request(app()).get(path).set(auth(meena));
      expect(response.status).toBe(404);
    }
  });

  it('is 404 when it names a client the account is not linked to', async () => {
    const response = await request(app())
      .get('/api/v1/portal/overview')
      .set(authWithClient(meena, anilCompany));
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('is 404 when it names a client that does not exist', async () => {
    const response = await request(app())
      .get('/api/v1/portal/overview')
      .set(authWithClient(meena, '64b7f0000000000000000000'));
    expect(response.status).toBe(404);
  });

  it('is 404 when it is not an identifier at all', async () => {
    const response = await request(app())
      .get('/api/v1/portal/overview')
      .set(authWithClient(meena, 'not-an-id'));
    expect(response.status).toBe(404);
  });

  it('works for each client the account is genuinely linked to', async () => {
    for (const clientId of [anilPersonal, anilCompany]) {
      const response = await request(app())
        .get('/api/v1/portal/overview')
        .set(authWithClient(anil, clientId));
      expect(response.status).toBe(200);
    }
  });
});

describe('the entity switcher', () => {
  it('lists exactly the linked clients and nothing else', async () => {
    const response = await request(app()).get('/api/v1/portal/clients').set(auth(anil));
    expect(response.status).toBe(200);
    const names = (response.body.data as Array<{ displayName: string }>).map(
      (row) => row.displayName,
    );
    expect(new Set(names)).toEqual(new Set(['Anil Personal', 'Anil Ventures']));
  });

  it('lists a single entry for a client linked to one record', async () => {
    const response = await request(app()).get('/api/v1/portal/clients').set(auth(meena));
    expect(response.body.data).toHaveLength(1);
  });
});

describe('the portal projection', () => {
  it('returns only the four permitted task fields', async () => {
    await makeTask({
      assignee: staff.id,
      client: meenaClient,
      title: 'Collect bank statements',
    });
    const response = await request(app())
      .get('/api/v1/portal/tasks')
      .set(authWithClient(meena, meenaClient));
    expect(response.status).toBe(200);
    const rows = response.body.data as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual(['dueDate', 'id', 'status', 'title']);
  });

  it('hides a task marked internal only', async () => {
    await makeTask({
      assignee: staff.id,
      client: meenaClient,
      title: 'Internal review of fees',
      internalOnly: true,
    });
    const response = await request(app())
      .get('/api/v1/portal/tasks')
      .set(authWithClient(meena, meenaClient));
    expect(response.body.data).toEqual([]);
  });

  it('returns compliance without notes, assignee or internal fields', async () => {
    await makeComplianceItem(meenaClient, typeId);
    const response = await request(app())
      .get('/api/v1/portal/compliance')
      .set(authWithClient(meena, meenaClient));
    expect(response.status).toBe(200);
    const rows = response.body.data as Array<Record<string, unknown>>;
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
      'complianceTypeName',
      'dueDate',
      'filedDate',
      'id',
      'isOverdue',
      'periodLabel',
      'status',
    ]);
  });
});

describe('shared routes under a client account', () => {
  it('refuses a document belonging to another client', async () => {
    const otherDocument = await makeDocument(anilCompany, staff.id);
    const response = await request(app())
      .get(`/api/v1/documents/${otherDocument.toString()}`)
      .set(authWithClient(meena, meenaClient));
    expect(response.status).toBe(404);
  });

  it('refuses a document list scoped to another client', async () => {
    const response = await request(app())
      .get(`/api/v1/documents?client=${anilCompany.toString()}`)
      .set(authWithClient(meena, meenaClient));
    expect(response.status).toBe(404);
  });

  it('refuses a message thread belonging to another client', async () => {
    const response = await request(app())
      .get(`/api/v1/clients/${anilCompany.toString()}/messages`)
      .set(authWithClient(meena, meenaClient));
    expect(response.status).toBe(404);
  });

  it('refuses a header that disagrees with the path', async () => {
    const response = await request(app())
      .get(`/api/v1/clients/${anilPersonal.toString()}/messages`)
      .set(authWithClient(anil, anilCompany));
    expect(response.status).toBe(404);
  });

  it('permits a message thread on the active client', async () => {
    const response = await request(app())
      .get(`/api/v1/clients/${meenaClient.toString()}/messages`)
      .set(authWithClient(meena, meenaClient));
    expect(response.status).toBe(200);
  });
});

describe('staff and admin accounts cannot use the portal', () => {
  it('refuses a staff account on every portal route', async () => {
    for (const path of ['/api/v1/portal/clients', '/api/v1/portal/overview']) {
      const response = await request(app())
        .get(path)
        .set({ ...auth(staff), 'X-Active-Client': meenaClient.toString() });
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    }
  });
});

describe('portal profile edits', () => {
  it('accepts a contact change and refuses an identifier change', async () => {
    const accepted = await request(app())
      .patch('/api/v1/portal/profile')
      .set(authWithClient(meena, meenaClient))
      .send({ address: { city: 'Pune', pincode: '411001' } });
    expect(accepted.status).toBe(200);
    expect((accepted.body.data as { address: { city: string } }).address.city).toBe('Pune');

    const refused = await request(app())
      .patch('/api/v1/portal/profile')
      .set(authWithClient(meena, meenaClient))
      .send({ gstin: '27ABCDE1234F1Z5' });
    expect(refused.status).toBe(403);
  });
});

describe('portal onboarding', () => {
  it('allows an unlinked client to submit business intake details and gain portal access', async () => {
    const unlinkedClient = await createAccount({ role: 'client', name: 'New Client' });
    const res = await request(app())
      .post('/api/v1/portal/onboarding')
      .set(auth(unlinkedClient))
      .send({
        clientType: 'business',
        displayName: 'New Enterprises LLP',
        legalName: 'New Enterprises LLP',
        entityType: 'llp',
        pan: 'ABCDE1234F',
        gstin: '27ABCDE1234F1Z5',
        primaryContact: {
          name: 'Partner Sharma',
          email: 'partner@example.com',
          phone: '9876543210',
          role: 'Managing Partner',
        },
        address: {
          line1: '123 MG Road',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
        },
        requestedServices: ['gst', 'income_tax'],
        notes: 'Need quarterly GST returns and annual filing.',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.client.displayName).toBe('New Enterprises LLP');
    expect(res.body.data.client.status).toBe('onboarding');
  });
});

