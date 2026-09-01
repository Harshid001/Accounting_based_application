import request from 'supertest';
import type { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';

import { AuditLog } from '../../src/models/auditLog.model.js';
import { Client } from '../../src/models/client.model.js';
import { assignStaff, makeClient } from '../helpers/factories.js';
import type { TestAccount } from '../helpers/auth.js';
import { app, auth, authWithClient, createAccount, linkClients } from '../helpers/auth.js';

const AADHAAR = '123456789012';

let admin: TestAccount;
let staff: TestAccount;
let owner: TestAccount;
let stranger: TestAccount;
let clientId: Types.ObjectId;
let otherClientId: Types.ObjectId;

beforeEach(async () => {
  admin = await createAccount({ role: 'admin' });
  staff = await createAccount({ role: 'staff' });
  owner = await createAccount({ role: 'client' });
  stranger = await createAccount({ role: 'client' });

  clientId = await makeClient({ displayName: 'Meena Individual', aadhaar: AADHAAR });
  otherClientId = await makeClient({ displayName: 'Other Individual' });
  await assignStaff(clientId, [staff.id]);
  await linkClients(owner, [clientId]);
  await linkClients(stranger, [otherClientId]);
});

describe('storage', () => {
  it('is encrypted at rest and excluded from a default read', async () => {
    const withoutSelect = await Client.findById(clientId).lean().exec();
    expect(withoutSelect).not.toHaveProperty('aadhaarEncrypted');

    const withSelect = await Client.findById(clientId).select('+aadhaarEncrypted').lean().exec();
    expect(withSelect?.aadhaarEncrypted?.ciphertext).toBeTypeOf('string');
    expect(JSON.stringify(withSelect?.aadhaarEncrypted)).not.toContain(AADHAAR);
  });
});

describe('staff', () => {
  it('receives a client record with no Aadhaar key at all', async () => {
    const response = await request(app())
      .get(`/api/v1/clients/${clientId.toString()}`)
      .set(auth(staff));
    expect(response.status).toBe(200);
    const body = response.body.data as Record<string, unknown>;
    expect(Object.keys(body)).not.toContain('aadhaar');
    expect(Object.keys(body)).not.toContain('aadhaarEncrypted');
    expect(Object.keys(body)).not.toContain('aadhaarPresent');
    expect(JSON.stringify(body)).not.toContain(AADHAAR);
  });

  it('is refused the reveal route entirely', async () => {
    const response = await request(app())
      .post(`/api/v1/clients/${clientId.toString()}/aadhaar/reveal`)
      .set(auth(staff));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('never sees it in a CSV export', async () => {
    const response = await request(app()).get('/api/v1/clients/export').set(auth(staff));
    expect(response.status).toBe(200);
    expect(response.text).not.toContain(AADHAAR);
    expect(response.text.toLowerCase()).not.toContain('aadhaar');
  });
});

describe('admin', () => {
  it('sees only that an Aadhaar is held, until it is revealed', async () => {
    const response = await request(app())
      .get(`/api/v1/clients/${clientId.toString()}`)
      .set(auth(admin));
    expect(response.status).toBe(200);
    expect((response.body.data as { aadhaarPresent: boolean }).aadhaarPresent).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain(AADHAAR);
  });

  it('reveals the value once and writes an audit entry naming actor and client', async () => {
    const response = await request(app())
      .post(`/api/v1/clients/${clientId.toString()}/aadhaar/reveal`)
      .set(auth(admin));
    expect(response.status).toBe(200);
    expect((response.body.data as { aadhaar: string }).aadhaar).toBe(AADHAAR);

    const entry = await AuditLog.findOne({ action: 'reveal_aadhaar' }).lean().exec();
    expect(entry).not.toBeNull();
    expect(entry?.actor?.toString()).toBe(admin.id.toString());
    expect(entry?.client?.toString()).toBe(clientId.toString());
    expect(JSON.stringify(entry)).not.toContain(AADHAAR);
  });

  it('gets a 404 when the client holds no Aadhaar', async () => {
    const response = await request(app())
      .post(`/api/v1/clients/${otherClientId.toString()}/aadhaar/reveal`)
      .set(auth(admin));
    expect(response.status).toBe(404);
  });
});

describe('the client it belongs to', () => {
  it('can read their own number, audited', async () => {
    const response = await request(app())
      .get('/api/v1/portal/aadhaar')
      .set(authWithClient(owner, clientId));
    expect(response.status).toBe(200);
    expect((response.body.data as { aadhaar: string }).aadhaar).toBe(AADHAAR);

    const entry = await AuditLog.findOne({ action: 'reveal_aadhaar' }).lean().exec();
    expect(entry?.actor?.toString()).toBe(owner.id.toString());
  });

  it('sees only a presence flag on their profile', async () => {
    const response = await request(app())
      .get('/api/v1/portal/profile')
      .set(authWithClient(owner, clientId));
    expect((response.body.data as { aadhaarPresent: boolean }).aadhaarPresent).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain(AADHAAR);
  });
});

describe('another client', () => {
  it('cannot read it by forging the active client header', async () => {
    const response = await request(app())
      .get('/api/v1/portal/aadhaar')
      .set(authWithClient(stranger, clientId));
    expect(response.status).toBe(404);
  });
});

describe('audit diffs', () => {
  it('record that the number changed without recording either value', async () => {
    const response = await request(app())
      .patch(`/api/v1/clients/${clientId.toString()}`)
      .set(auth(admin))
      .send({ aadhaar: '210987654321' });
    expect(response.status).toBe(200);

    const entry = await AuditLog.findOne({ action: 'update', entityKind: 'client' })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const change = entry?.diff.find((row) => row.field === 'aadhaarEncrypted');
    expect(change).toBeDefined();
    expect(change?.redacted).toBe(true);
    expect(JSON.stringify(entry)).not.toContain('210987654321');
    expect(JSON.stringify(entry)).not.toContain(AADHAAR);
  });
});

describe('an individual identifier on a business record', () => {
  it('is refused by the schema, not only by validation', async () => {
    await expect(
      makeClient({ clientType: 'business', displayName: 'Bad Business', aadhaar: AADHAAR }),
    ).rejects.toThrow();
  });
});
