import request from 'supertest';
import type { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';

import { AuditLog } from '../../src/models/auditLog.model.js';
import {
  assignStaff,
  makeClient,
  makeComplianceItem,
  makeComplianceType,
  makeTask,
} from '../helpers/factories.js';
import type { TestAccount } from '../helpers/auth.js';
import { app, auth, createAccount } from '../helpers/auth.js';

let admin: TestAccount;
let staff: TestAccount;
let clientId: Types.ObjectId;
let typeId: Types.ObjectId;

beforeEach(async () => {
  admin = await createAccount({ role: 'admin' });
  staff = await createAccount({ role: 'staff' });
  clientId = await makeClient({ displayName: 'Audited Client' });
  await assignStaff(clientId, [staff.id]);
  typeId = await makeComplianceType();
});

describe('entries are written', () => {
  it('records a sign-in with the actor and role', async () => {
    const entry = await AuditLog.findOne({ action: 'sign_in', actor: staff.id }).lean().exec();
    expect(entry).not.toBeNull();
    expect(entry?.actorRole).toBe('staff');
  });

  it('records a client creation with the affected client', async () => {
    const response = await request(app())
      .post('/api/v1/clients')
      .set(auth(admin))
      .send({
        clientType: 'individual',
        displayName: 'Newly Created',
        primaryContact: { name: 'Contact', email: 'new.contact@firmdesk.test' },
      });
    expect(response.status).toBe(201);
    const created = (response.body.data as { id: string }).id;

    const entry = await AuditLog.findOne({ action: 'create', entityKind: 'client' }).lean().exec();
    expect(entry?.entityId?.toString()).toBe(created);
    expect(entry?.client?.toString()).toBe(created);
    expect(entry?.actor?.toString()).toBe(admin.id.toString());
    expect(entry?.requestId).toBeTypeOf('string');
  });

  it('records a field level diff on an update', async () => {
    await request(app())
      .patch(`/api/v1/clients/${clientId.toString()}`)
      .set(auth(admin))
      .send({ displayName: 'Renamed Client' });

    const entry = await AuditLog.findOne({ action: 'update', entityKind: 'client' })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const change = entry?.diff.find((row) => row.field === 'displayName');
    expect(change?.before).toBe('Audited Client');
    expect(change?.after).toBe('Renamed Client');
  });

  it('records a status change with before and after', async () => {
    const itemId = await makeComplianceItem(clientId, typeId);
    await request(app())
      .post(`/api/v1/compliance/${itemId.toString()}/status`)
      .set(auth(staff))
      .send({ status: 'filed', filedDate: '2026-07-15' });

    const entry = await AuditLog.findOne({ action: 'status_change' }).sort({ createdAt: -1 }).lean().exec();
    expect(entry?.summary).toContain('pending');
    expect(entry?.summary).toContain('filed');
  });

  it('records an assignment', async () => {
    const other = await createAccount({ role: 'staff' });
    await assignStaff(clientId, [staff.id, other.id]);
    const taskId = await makeTask({ assignee: staff.id, client: clientId });

    await request(app())
      .post(`/api/v1/tasks/${taskId.toString()}/assign`)
      .set(auth(admin))
      .send({ assigneeId: other.id.toString() });

    const entry = await AuditLog.findOne({ action: 'assign', entityKind: 'task' }).lean().exec();
    expect(entry).not.toBeNull();
  });

  it('records archive and restore separately', async () => {
    await request(app()).post(`/api/v1/clients/${clientId.toString()}/archive`).set(auth(admin));
    await request(app()).post(`/api/v1/clients/${clientId.toString()}/restore`).set(auth(admin));

    expect(await AuditLog.countDocuments({ action: 'archive' })).toBe(1);
    expect(await AuditLog.countDocuments({ action: 'restore' })).toBe(1);
  });

  it('records an export with a count', async () => {
    await request(app()).get('/api/v1/clients/export').set(auth(admin));
    const entry = await AuditLog.findOne({ action: 'export' }).lean().exec();
    expect(entry?.summary).toContain('CSV');
  });

  it('records a role change', async () => {
    await request(app())
      .post(`/api/v1/users/${staff.id.toString()}/role`)
      .set(auth(admin))
      .send({ role: 'admin' });
    const entry = await AuditLog.findOne({ action: 'role_change' }).lean().exec();
    expect(entry?.summary).toContain('staff');
    expect(entry?.summary).toContain('admin');
  });
});

describe('reads are not audited', () => {
  it('writes nothing for a plain list read', async () => {
    await AuditLog.deleteMany({}).exec();
    await request(app()).get('/api/v1/clients').set(auth(admin));
    await request(app()).get(`/api/v1/clients/${clientId.toString()}`).set(auth(admin));
    expect(await AuditLog.countDocuments()).toBe(0);
  });
});

describe('the log is append only', () => {
  it('offers no update or delete route at any role', async () => {
    for (const method of ['post', 'patch', 'put', 'delete'] as const) {
      const response = await request(app())[method]('/api/v1/audit').set(auth(admin)).send({});
      expect(response.status).toBe(404);
    }
  });

  it('is unreadable by staff', async () => {
    const response = await request(app()).get('/api/v1/audit').set(auth(staff));
    expect(response.status).toBe(403);
  });

  it('filters by actor, entity, client, action and date for an admin', async () => {
    await request(app())
      .patch(`/api/v1/clients/${clientId.toString()}`)
      .set(auth(admin))
      .send({ notes: 'A note' });

    const byAction = await request(app())
      .get('/api/v1/audit?action=update')
      .set(auth(admin));
    expect(byAction.status).toBe(200);
    expect((byAction.body.data as unknown[]).length).toBeGreaterThan(0);

    const byClient = await request(app())
      .get(`/api/v1/audit?client=${clientId.toString()}`)
      .set(auth(admin));
    expect((byClient.body.data as Array<{ client: { id: string } | null }>).every(
      (row) => row.client?.id === clientId.toString(),
    )).toBe(true);

    const byActor = await request(app())
      .get(`/api/v1/audit?actor=${admin.id.toString()}`)
      .set(auth(admin));
    expect((byActor.body.data as unknown[]).length).toBeGreaterThan(0);

    const byNobody = await request(app())
      .get('/api/v1/audit?actor=64b7f0000000000000000000')
      .set(auth(admin));
    expect(byNobody.body.data).toEqual([]);
  });
});

describe('the client activity tab', () => {
  it('shows entries for that client only', async () => {
    const other = await makeClient({ displayName: 'Other Client' });
    await assignStaff(other, [staff.id]);
    await request(app())
      .patch(`/api/v1/clients/${clientId.toString()}`)
      .set(auth(staff))
      .send({ notes: 'One' });
    await request(app())
      .patch(`/api/v1/clients/${other.toString()}`)
      .set(auth(staff))
      .send({ notes: 'Two' });

    const response = await request(app())
      .get(`/api/v1/clients/${clientId.toString()}/activity`)
      .set(auth(staff));
    expect(response.status).toBe(200);
    const rows = response.body.data as Array<{ client: { id: string } | null }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.client?.id === clientId.toString())).toBe(true);
  });
});

describe('sensitive values never enter a diff', () => {
  it('redacts every field on the redaction list', async () => {
    const { REDACTED_AUDIT_FIELDS } = await import('../../src/lib/enums.js');
    const { buildDiff } = await import('../../src/services/audit.service.js');

    for (const field of REDACTED_AUDIT_FIELDS) {
      const diff = buildDiff({ [field]: 'OLD-VALUE-1234' }, { [field]: 'NEW-VALUE-5678' });
      expect(diff).toHaveLength(1);
      expect(diff[0]?.redacted).toBe(true);
      expect(diff[0]?.field).toBe(field);
      expect(JSON.stringify(diff)).not.toContain('OLD-VALUE-1234');
      expect(JSON.stringify(diff)).not.toContain('NEW-VALUE-5678');
    }
  });

  it('redacts a nested path ending in a sensitive name', async () => {
    const { buildDiff } = await import('../../src/services/audit.service.js');
    const diff = buildDiff({ 'client.aadhaar': 'a' }, { 'client.aadhaar': 'b' });
    expect(diff[0]?.redacted).toBe(true);
  });
});
