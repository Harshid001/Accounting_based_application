import request from 'supertest';
import type { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Role } from '../../src/lib/enums.js';
import { CAPABILITIES, roleHasCapability } from '../../src/middleware/permissions.js';
import {
  assignStaff,
  makeClient,
  makeClientService,
  makeComplianceItem,
  makeComplianceType,
  makeDocument,
  makeDocumentRequest,
  makeTask,
} from '../helpers/factories.js';
import type { TestAccount } from '../helpers/auth.js';
import { app, auth, authWithClient, createAccount, linkClients } from '../helpers/auth.js';

interface RouteCase {
  method: 'get' | 'post' | 'patch' | 'put' | 'delete';
  path: string;
  allowed: Role[];
  body?: Record<string, unknown>;
  portal?: boolean;
}

let admin: TestAccount;
let staff: TestAccount;
let client: TestAccount;
let clientId: Types.ObjectId;
let typeId: Types.ObjectId;
let serviceId: Types.ObjectId;
let itemId: Types.ObjectId;
let taskId: Types.ObjectId;
let documentId: Types.ObjectId;
let requestId: Types.ObjectId;
let cases: RouteCase[];

beforeEach(async () => {
  admin = await createAccount({ role: 'admin' });
  staff = await createAccount({ role: 'staff' });
  client = await createAccount({ role: 'client' });

  clientId = await makeClient();
  await assignStaff(clientId, [staff.id]);
  await linkClients(client, [clientId]);
  client = { ...client, id: client.id };

  typeId = await makeComplianceType();
  serviceId = await makeClientService(clientId, typeId, { assignedStaff: staff.id });
  itemId = await makeComplianceItem(clientId, typeId, { assignedStaff: staff.id });
  taskId = await makeTask({ assignee: staff.id, client: clientId });
  documentId = await makeDocument(clientId, staff.id);
  requestId = await makeDocumentRequest(clientId, staff.id);

  cases = [
    { method: 'get', path: '/api/v1/me', allowed: ['admin', 'staff', 'client'] },
    { method: 'patch', path: '/api/v1/me', allowed: ['admin', 'staff', 'client'], body: { name: 'Renamed' } },
    { method: 'get', path: '/api/v1/me/sessions', allowed: ['admin', 'staff', 'client'] },

    { method: 'get', path: '/api/v1/clients', allowed: ['admin', 'staff'] },
    { method: 'get', path: '/api/v1/clients/export', allowed: ['admin', 'staff'] },
    {
      method: 'post',
      path: '/api/v1/clients',
      allowed: ['admin'],
      body: {
        clientType: 'individual',
        displayName: 'Fresh Individual',
        primaryContact: { name: 'Fresh Contact', email: 'fresh.contact@firmdesk.test' },
      },
    },
    { method: 'get', path: `/api/v1/clients/${clientId.toString()}`, allowed: ['admin', 'staff'] },
    {
      method: 'patch',
      path: `/api/v1/clients/${clientId.toString()}`,
      allowed: ['admin', 'staff'],
      body: { notes: 'Internal note' },
    },
    { method: 'post', path: `/api/v1/clients/${clientId.toString()}/archive`, allowed: ['admin'] },
    { method: 'post', path: `/api/v1/clients/${clientId.toString()}/restore`, allowed: ['admin'] },
    {
      method: 'put',
      path: `/api/v1/clients/${clientId.toString()}/assignments`,
      allowed: ['admin'],
      body: { staffIds: [] },
    },
    { method: 'post', path: `/api/v1/clients/${clientId.toString()}/pin`, allowed: ['admin', 'staff'] },
    { method: 'delete', path: `/api/v1/clients/${clientId.toString()}/pin`, allowed: ['admin', 'staff'] },
    {
      method: 'post',
      path: `/api/v1/clients/${clientId.toString()}/aadhaar/reveal`,
      allowed: ['admin'],
    },
    { method: 'get', path: `/api/v1/clients/${clientId.toString()}/activity`, allowed: ['admin', 'staff'] },
    { method: 'get', path: `/api/v1/clients/${clientId.toString()}/services`, allowed: ['admin', 'staff'] },
    { method: 'get', path: `/api/v1/clients/${clientId.toString()}/messages`, allowed: ['admin', 'staff', 'client'] },
    {
      method: 'post',
      path: `/api/v1/clients/${clientId.toString()}/messages`,
      allowed: ['admin', 'staff', 'client'],
      body: { body: 'Hello from the tests' },
    },

    { method: 'get', path: '/api/v1/compliance-types', allowed: ['admin', 'staff'] },
    { method: 'get', path: `/api/v1/compliance-types/${typeId.toString()}`, allowed: ['admin', 'staff'] },
    { method: 'delete', path: `/api/v1/compliance-types/${typeId.toString()}`, allowed: ['admin'] },
    {
      method: 'patch',
      path: `/api/v1/client-services/${serviceId.toString()}`,
      allowed: ['admin', 'staff'],
      body: { active: true },
    },
    { method: 'delete', path: `/api/v1/client-services/${serviceId.toString()}`, allowed: ['admin'] },

    { method: 'get', path: '/api/v1/compliance', allowed: ['admin', 'staff'] },
    { method: 'get', path: '/api/v1/compliance/export', allowed: ['admin', 'staff'] },
    { method: 'get', path: `/api/v1/compliance/${itemId.toString()}`, allowed: ['admin', 'staff'] },
    {
      method: 'patch',
      path: `/api/v1/compliance/${itemId.toString()}`,
      allowed: ['admin', 'staff'],
      body: { notes: 'Working on it' },
    },
    {
      method: 'post',
      path: `/api/v1/compliance/${itemId.toString()}/status`,
      allowed: ['admin', 'staff'],
      body: { status: 'in_progress' },
    },
    { method: 'delete', path: `/api/v1/compliance/${itemId.toString()}`, allowed: ['admin'] },
    {
      method: 'post',
      path: '/api/v1/compliance/generate/preview',
      allowed: ['admin'],
      body: {
        complianceTypeId: typeId.toString(),
        periodStart: '2026-04-01',
        periodEnd: '2026-04-30',
      },
    },

    { method: 'get', path: '/api/v1/tasks', allowed: ['admin', 'staff'] },
    { method: 'get', path: `/api/v1/tasks/${taskId.toString()}`, allowed: ['admin', 'staff'] },
    {
      method: 'patch',
      path: `/api/v1/tasks/${taskId.toString()}`,
      allowed: ['admin', 'staff'],
      body: { priority: 'high' },
    },
    { method: 'delete', path: `/api/v1/tasks/${taskId.toString()}`, allowed: ['admin'] },
    { method: 'get', path: `/api/v1/tasks/${taskId.toString()}/comments`, allowed: ['admin', 'staff'] },
    {
      method: 'post',
      path: `/api/v1/tasks/${taskId.toString()}/comments`,
      allowed: ['admin', 'staff'],
      body: { body: 'Internal note' },
    },
    { method: 'get', path: '/api/v1/my-work', allowed: ['admin', 'staff'] },

    { method: 'get', path: `/api/v1/documents?client=${clientId.toString()}`, allowed: ['admin', 'staff', 'client'] },
    { method: 'get', path: `/api/v1/documents/${documentId.toString()}`, allowed: ['admin', 'staff', 'client'] },
    {
      method: 'get',
      path: `/api/v1/documents/${documentId.toString()}/download`,
      allowed: ['admin', 'staff', 'client'],
    },
    {
      method: 'patch',
      path: `/api/v1/documents/${documentId.toString()}`,
      allowed: ['admin', 'staff'],
      body: { title: 'Renamed document' },
    },
    { method: 'post', path: `/api/v1/documents/${documentId.toString()}/archive`, allowed: ['admin', 'staff', 'client'] },
    {
      method: 'delete',
      path: `/api/v1/documents/${documentId.toString()}`,
      allowed: ['admin'],
      body: { confirm: 'Bank statement — Mar 2026' },
    },

    { method: 'get', path: '/api/v1/document-requests', allowed: ['admin', 'staff'] },
    {
      method: 'patch',
      path: `/api/v1/document-requests/${requestId.toString()}`,
      allowed: ['admin', 'staff'],
      body: { title: 'Renamed request' },
    },
    { method: 'post', path: `/api/v1/document-requests/${requestId.toString()}/cancel`, allowed: ['admin', 'staff'] },
    { method: 'post', path: `/api/v1/document-requests/${requestId.toString()}/remind`, allowed: ['admin', 'staff'] },

    { method: 'get', path: '/api/v1/messages/threads', allowed: ['admin', 'staff'] },
    { method: 'get', path: '/api/v1/notifications', allowed: ['admin', 'staff', 'client'] },
    { method: 'get', path: '/api/v1/notifications/unread-count', allowed: ['admin', 'staff', 'client'] },
    { method: 'post', path: '/api/v1/notifications/read-all', allowed: ['admin', 'staff', 'client'] },

    { method: 'get', path: '/api/v1/users', allowed: ['admin'] },
    { method: 'get', path: `/api/v1/users/${staff.id.toString()}`, allowed: ['admin'] },
    {
      method: 'patch',
      path: `/api/v1/users/${staff.id.toString()}`,
      allowed: ['admin'],
      body: { name: 'Renamed staff' },
    },
    {
      method: 'post',
      path: `/api/v1/users/${staff.id.toString()}/role`,
      allowed: ['admin'],
      body: { role: 'staff' },
    },
    {
      method: 'put',
      path: `/api/v1/users/${client.id.toString()}/linked-clients`,
      allowed: ['admin'],
      body: { clientIds: [clientId.toString()] },
    },
    { method: 'delete', path: '/api/v1/users/unlinked', allowed: ['admin'], body: { olderThanDays: 3650 } },

    { method: 'get', path: '/api/v1/settings/firm', allowed: ['admin', 'staff', 'client'] },
    { method: 'patch', path: '/api/v1/settings/firm', allowed: ['admin'], body: { firmName: 'Test Firm' } },

    { method: 'get', path: '/api/v1/reports/dashboard', allowed: ['admin', 'staff'] },
    { method: 'get', path: '/api/v1/reports/compliance', allowed: ['admin', 'staff'] },
    { method: 'get', path: '/api/v1/reports/workload', allowed: ['admin', 'staff'] },
    { method: 'get', path: '/api/v1/reports/roster', allowed: ['admin', 'staff'] },
    { method: 'get', path: '/api/v1/reports/roster/export', allowed: ['admin', 'staff'] },

    { method: 'get', path: '/api/v1/audit', allowed: ['admin'] },
    { method: 'get', path: '/api/v1/jobs', allowed: ['admin'] },
    { method: 'post', path: '/api/v1/jobs/rollRecurringTasks/run', allowed: ['admin'] },
    { method: 'get', path: '/api/v1/search?q=test', allowed: ['admin', 'staff'] },

    { method: 'get', path: '/api/v1/portal/clients', allowed: ['client'], portal: true },
    { method: 'get', path: '/api/v1/portal/overview', allowed: ['client'], portal: true },
    { method: 'get', path: '/api/v1/portal/compliance', allowed: ['client'], portal: true },
    { method: 'get', path: '/api/v1/portal/tasks', allowed: ['client'], portal: true },
    { method: 'get', path: '/api/v1/portal/requests', allowed: ['client'], portal: true },
    { method: 'get', path: '/api/v1/portal/profile', allowed: ['client'], portal: true },
    {
      method: 'patch',
      path: '/api/v1/portal/profile',
      allowed: ['client'],
      portal: true,
      body: { address: { city: 'Pune' } },
    },
  ];
});

const accountFor = (role: Role): TestAccount => {
  if (role === 'admin') return admin;
  if (role === 'staff') return staff;
  return client;
};

const send = async (route: RouteCase, role: Role) => {
  const account = accountFor(role);
  const headers =
    role === 'client' ? authWithClient(account, clientId) : auth(account);
  const agent = request(app())[route.method](route.path).set(headers);
  return route.body === undefined ? agent : agent.send(route.body);
};

describe('the permission matrix is data, and the routes obey it', () => {
  it('names every capability used by a route', () => {
    expect(Object.keys(CAPABILITIES).length).toBeGreaterThan(30);
    expect(roleHasCapability('client', 'client:create')).toBe(false);
    expect(roleHasCapability('staff', 'user:manage')).toBe(false);
    expect(roleHasCapability('admin', 'portal:read')).toBe(false);
  });

  it('refuses an unknown capability, failing closed', () => {
    expect(roleHasCapability('admin', 'nonexistent:capability')).toBe(false);
  });
});

describe('every role against every route', () => {
  for (const role of ['admin', 'staff', 'client'] as const) {
    it(`lets ${role} through exactly the routes the matrix permits`, async () => {
      const wrongly: string[] = [];
      for (const route of cases) {
        const response = await send(route, role);
        const permitted = route.allowed.includes(role);
        const refused = response.status === 403 || response.status === 401;
        if (permitted && refused) {
          wrongly.push(
            `${route.method.toUpperCase()} ${route.path} refused ${role} with ${response.status.toString()}`,
          );
        }
        if (!permitted && !refused) {
          wrongly.push(
            `${route.method.toUpperCase()} ${route.path} admitted ${role} with ${response.status.toString()}`,
          );
        }
      }
      expect(wrongly).toEqual([]);
    });
  }
});

describe('routes that must not exist at all', () => {
  it('offers no write path into the audit log at any role', async () => {
    for (const account of [admin, staff, client]) {
      for (const method of ['post', 'patch', 'put', 'delete'] as const) {
        const agent = request(app());
        const response = await agent[method]('/api/v1/audit')
          .set(auth(account))
          .send({ action: 'create' });
        expect(response.status).toBe(404);
      }
      const single = await request(app())
        .delete('/api/v1/audit/64b7f0000000000000000000')
        .set(auth(account));
      expect(single.status).toBe(404);
    }
  });

  it('offers no hard delete for a client record', async () => {
    const response = await request(app())
      .delete(`/api/v1/clients/${clientId.toString()}`)
      .set(auth(admin));
    expect(response.status).toBe(404);
  });

  it('offers no edit or delete route for a posted message', async () => {
    const posted = await request(app())
      .post(`/api/v1/clients/${clientId.toString()}/messages`)
      .set(auth(staff))
      .send({ body: 'This message is a record' });
    expect(posted.status).toBe(201);
    const messageId = (posted.body.data as { id: string }).id;

    for (const method of ['patch', 'delete'] as const) {
      const response = await request(app())[method](`/api/v1/messages/${messageId}`)
        .set(auth(admin))
        .send({ body: 'rewritten' });
      expect(response.status).toBe(404);
    }
  });
});

describe('privileged fields are rejected, not silently dropped', () => {
  it('refuses a role change through the self-service profile route', async () => {
    const response = await request(app())
      .patch('/api/v1/me')
      .set(auth(client))
      .send({ name: 'Renamed', role: 'admin' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('refuses a staff member editing a statutory identifier', async () => {
    const response = await request(app())
      .patch(`/api/v1/clients/${clientId.toString()}`)
      .set(auth(staff))
      .send({ pan: 'ZZZZZ9999Z' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('refuses a client editing their own statutory identifier through the portal', async () => {
    const response = await request(app())
      .patch('/api/v1/portal/profile')
      .set(authWithClient(client, clientId))
      .send({ pan: 'ZZZZZ9999Z' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('refuses a staff member changing assigned staff on a client', async () => {
    const response = await request(app())
      .patch(`/api/v1/clients/${clientId.toString()}`)
      .set(auth(staff))
      .send({ assignedStaff: [] });
    expect(response.status).toBe(403);
  });
});
