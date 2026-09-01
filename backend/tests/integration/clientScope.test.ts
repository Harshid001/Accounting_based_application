import request from 'supertest';
import type { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  assignStaff,
  makeClient,
  makeComplianceItem,
  makeComplianceType,
  makeDocument,
  makeDocumentRequest,
  makeTask,
} from '../helpers/factories.js';
import type { TestAccount } from '../helpers/auth.js';
import { app, auth, createAccount } from '../helpers/auth.js';

let staff: TestAccount;
let otherStaff: TestAccount;
let mine: Types.ObjectId;
let theirs: Types.ObjectId;
let typeId: Types.ObjectId;

beforeEach(async () => {
  staff = await createAccount({ role: 'staff', name: 'Rahul' });
  otherStaff = await createAccount({ role: 'staff', name: 'Sana' });

  mine = await makeClient({ displayName: 'Assigned Client' });
  theirs = await makeClient({ displayName: 'Unassigned Client' });
  await assignStaff(mine, [staff.id]);
  await assignStaff(theirs, [otherStaff.id]);
  typeId = await makeComplianceType();
});

describe('the client list', () => {
  it('returns only assigned clients', async () => {
    const response = await request(app()).get('/api/v1/clients').set(auth(staff));
    expect(response.status).toBe(200);
    const names = (response.body.data as Array<{ displayName: string }>).map(
      (row) => row.displayName,
    );
    expect(names).toEqual(['Assigned Client']);
  });

  it('cannot be widened with assignedTo', async () => {
    const response = await request(app())
      .get(`/api/v1/clients?assignedTo=${otherStaff.id.toString()}`)
      .set(auth(staff));
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it('exports only assigned clients', async () => {
    const response = await request(app()).get('/api/v1/clients/export').set(auth(staff));
    expect(response.status).toBe(200);
    expect(response.text).toContain('Assigned Client');
    expect(response.text).not.toContain('Unassigned Client');
  });
});

describe('reading an unassigned client', () => {
  it('is 404, never 403, so existence is not disclosed', async () => {
    const response = await request(app())
      .get(`/api/v1/clients/${theirs.toString()}`)
      .set(auth(staff));
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('is 404 for every nested route on that client', async () => {
    const paths = [
      `/api/v1/clients/${theirs.toString()}/activity`,
      `/api/v1/clients/${theirs.toString()}/services`,
      `/api/v1/clients/${theirs.toString()}/messages`,
    ];
    for (const path of paths) {
      const response = await request(app()).get(path).set(auth(staff));
      expect(response.status).toBe(404);
    }
  });

  it('is 404 when writing, not a silent success', async () => {
    const response = await request(app())
      .patch(`/api/v1/clients/${theirs.toString()}`)
      .set(auth(staff))
      .send({ notes: 'I should not be able to write this' });
    expect(response.status).toBe(404);
  });

  it('is 404 for an identifier that matches nothing at all', async () => {
    const response = await request(app())
      .get('/api/v1/clients/64b7f0000000000000000000')
      .set(auth(staff));
    expect(response.status).toBe(404);
  });

  it('is a validation failure, not a cast exception, for a malformed identifier', async () => {
    const response = await request(app()).get('/api/v1/clients/not-an-id').set(auth(staff));
    expect(response.status).toBe(404);
  });
});

describe('records that belong to an unassigned client', () => {
  it('hides compliance items from lists and detail reads', async () => {
    const hidden = await makeComplianceItem(theirs, typeId);
    const visible = await makeComplianceItem(mine, typeId);

    const list = await request(app()).get('/api/v1/compliance').set(auth(staff));
    const ids = (list.body.data as Array<{ id: string }>).map((row) => row.id);
    expect(ids).toContain(visible.toString());
    expect(ids).not.toContain(hidden.toString());

    const detail = await request(app())
      .get(`/api/v1/compliance/${hidden.toString()}`)
      .set(auth(staff));
    expect(detail.status).toBe(404);
  });

  it('rejects a filter that names an unassigned client', async () => {
    const response = await request(app())
      .get(`/api/v1/compliance?client=${theirs.toString()}`)
      .set(auth(staff));
    expect(response.status).toBe(404);
  });

  it('hides tasks belonging to an unassigned client', async () => {
    const hidden = await makeTask({ assignee: otherStaff.id, client: theirs });
    const list = await request(app()).get('/api/v1/tasks').set(auth(staff));
    const ids = (list.body.data as Array<{ id: string }>).map((row) => row.id);
    expect(ids).not.toContain(hidden.toString());

    const detail = await request(app())
      .get(`/api/v1/tasks/${hidden.toString()}`)
      .set(auth(staff));
    expect(detail.status).toBe(404);
  });

  it('hides documents belonging to an unassigned client', async () => {
    const hidden = await makeDocument(theirs, otherStaff.id);
    const list = await request(app())
      .get(`/api/v1/documents?client=${theirs.toString()}`)
      .set(auth(staff));
    expect(list.status).toBe(404);

    const detail = await request(app())
      .get(`/api/v1/documents/${hidden.toString()}`)
      .set(auth(staff));
    expect(detail.status).toBe(404);

    const download = await request(app())
      .get(`/api/v1/documents/${hidden.toString()}/download`)
      .set(auth(staff));
    expect(download.status).toBe(404);
  });

  it('hides document requests belonging to an unassigned client', async () => {
    const hidden = await makeDocumentRequest(theirs, otherStaff.id);
    const list = await request(app()).get('/api/v1/document-requests').set(auth(staff));
    const ids = (list.body.data as Array<{ id: string }>).map((row) => row.id);
    expect(ids).not.toContain(hidden.toString());

    const cancel = await request(app())
      .post(`/api/v1/document-requests/${hidden.toString()}/cancel`)
      .set(auth(staff));
    expect(cancel.status).toBe(404);
  });

  it('refuses to create work against an unassigned client', async () => {
    const task = await request(app())
      .post('/api/v1/tasks')
      .set(auth(staff))
      .send({ title: 'Sneaky task', clientId: theirs.toString(), assigneeId: staff.id.toString() });
    expect(task.status).toBe(404);

    const filing = await request(app())
      .post('/api/v1/compliance')
      .set(auth(staff))
      .send({
        clientId: theirs.toString(),
        complianceTypeId: typeId.toString(),
        periodType: 'month',
        periodAnchor: '2026-05-10',
      });
    expect(filing.status).toBe(404);
  });
});

describe('search and reports', () => {
  it('searches inside the caller scope only', async () => {
    const response = await request(app()).get('/api/v1/search?q=Client').set(auth(staff));
    expect(response.status).toBe(200);
    const names = (response.body.data.clients as Array<{ title: string }>).map(
      (row) => row.title,
    );
    expect(names).toEqual(['Assigned Client']);
  });

  it('reports only on assigned clients', async () => {
    await makeComplianceItem(theirs, typeId);
    await makeComplianceItem(mine, typeId);

    const response = await request(app()).get('/api/v1/reports/compliance').set(auth(staff));
    expect(response.status).toBe(200);
    const clients = (response.body.data.rows as Array<{ clientName: string }>).map(
      (row) => row.clientName,
    );
    expect(new Set(clients)).toEqual(new Set(['Assigned Client']));
  });

  it('shows a staff member only their own workload row', async () => {
    const response = await request(app()).get('/api/v1/reports/workload').set(auth(staff));
    expect(response.status).toBe(200);
    const rows = response.body.data as Array<{ staffId: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.staffId).toBe(staff.id.toString());
  });
});

describe('an admin sees everything', () => {
  it('lists both clients', async () => {
    const admin = await createAccount({ role: 'admin' });
    const response = await request(app()).get('/api/v1/clients').set(auth(admin));
    expect(response.status).toBe(200);
    expect((response.body.data as unknown[]).length).toBe(2);
  });
});
