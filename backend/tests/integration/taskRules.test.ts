import request from 'supertest';
import type { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';

import { Task } from '../../src/models/task.model.js';
import { assignStaff, makeClient, makeDocument, makeTask } from '../helpers/factories.js';
import type { TestAccount } from '../helpers/auth.js';
import { app, auth, createAccount } from '../helpers/auth.js';

let admin: TestAccount;
let rahul: TestAccount;
let sana: TestAccount;
let outsider: TestAccount;
let clientId: Types.ObjectId;

beforeEach(async () => {
  admin = await createAccount({ role: 'admin' });
  rahul = await createAccount({ role: 'staff', name: 'Rahul' });
  sana = await createAccount({ role: 'staff', name: 'Sana' });
  outsider = await createAccount({ role: 'staff', name: 'Outsider' });

  clientId = await makeClient({ displayName: 'Shared Client' });
  await assignStaff(clientId, [rahul.id, sana.id]);
});

const createTask = (account: TestAccount, body: Record<string, unknown>) =>
  request(app()).post('/api/v1/tasks').set(auth(account)).send(body);

describe('dependency cycles', () => {
  it('rejects a two-task cycle with CONFLICT', async () => {
    const first = await makeTask({ assignee: rahul.id, client: clientId, title: 'First task' });
    const second = await makeTask({
      assignee: rahul.id,
      client: clientId,
      title: 'Second task',
      blockedBy: [first],
    });

    const response = await request(app())
      .patch(`/api/v1/tasks/${first.toString()}`)
      .set(auth(rahul))
      .send({ blockedBy: [second.toString()] });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('rejects a longer chain that closes on itself', async () => {
    const a = await makeTask({ assignee: rahul.id, client: clientId, title: 'Task A' });
    const b = await makeTask({
      assignee: rahul.id,
      client: clientId,
      title: 'Task B',
      blockedBy: [a],
    });
    const c = await makeTask({
      assignee: rahul.id,
      client: clientId,
      title: 'Task C',
      blockedBy: [b],
    });

    const response = await request(app())
      .patch(`/api/v1/tasks/${a.toString()}`)
      .set(auth(rahul))
      .send({ blockedBy: [c.toString()] });
    expect(response.status).toBe(409);
  });

  it('accepts a chain that does not close', async () => {
    const a = await makeTask({ assignee: rahul.id, client: clientId, title: 'Task A' });
    const b = await makeTask({ assignee: rahul.id, client: clientId, title: 'Task B' });

    const response = await request(app())
      .patch(`/api/v1/tasks/${b.toString()}`)
      .set(auth(rahul))
      .send({ blockedBy: [a.toString()] });
    expect(response.status).toBe(200);
  });

  it('refuses a task that blocks itself', async () => {
    const a = await makeTask({ assignee: rahul.id, client: clientId, title: 'Task A' });
    const response = await request(app())
      .patch(`/api/v1/tasks/${a.toString()}`)
      .set(auth(rahul))
      .send({ blockedBy: [a.toString()] });
    expect(response.status).toBe(409);
  });

  it('reports which blockers are still open', async () => {
    const blocker = await makeTask({
      assignee: rahul.id,
      client: clientId,
      title: 'Waiting on this',
    });
    const blocked = await makeTask({
      assignee: rahul.id,
      client: clientId,
      title: 'Cannot start',
      blockedBy: [blocker],
    });

    const response = await request(app())
      .get(`/api/v1/tasks/${blocked.toString()}`)
      .set(auth(rahul));
    expect(response.status).toBe(200);
    const open = response.body.data.blockedByOpen as Array<{ title: string }>;
    expect(open).toHaveLength(1);
    expect(open[0]?.title).toBe('Waiting on this');
  });
});

describe('reassignment cannot widen access', () => {
  it('lets a staff member hand over to another staff member on the same client', async () => {
    const task = await makeTask({ assignee: rahul.id, client: clientId, title: 'Handover' });
    const response = await request(app())
      .post(`/api/v1/tasks/${task.toString()}/assign`)
      .set(auth(rahul))
      .send({ assigneeId: sana.id.toString() });
    expect(response.status).toBe(200);
  });

  it('refuses a handover to someone not assigned to that client', async () => {
    const task = await makeTask({ assignee: rahul.id, client: clientId, title: 'Handover' });
    const response = await request(app())
      .post(`/api/v1/tasks/${task.toString()}/assign`)
      .set(auth(rahul))
      .send({ assigneeId: outsider.id.toString() });
    expect(response.status).toBe(403);
  });

  it('refuses a staff member reassigning a task they do not own', async () => {
    const task = await makeTask({ assignee: sana.id, client: clientId, title: 'Not mine' });
    const response = await request(app())
      .post(`/api/v1/tasks/${task.toString()}/assign`)
      .set(auth(rahul))
      .send({ assigneeId: rahul.id.toString() });
    expect(response.status).toBe(403);
  });

  it('lets an admin assign anyone', async () => {
    const task = await makeTask({ assignee: rahul.id, client: clientId, title: 'Admin move' });
    const response = await request(app())
      .post(`/api/v1/tasks/${task.toString()}/assign`)
      .set(auth(admin))
      .send({ assigneeId: outsider.id.toString() });
    expect(response.status).toBe(200);
  });

  it('refuses creating a task assigned to someone off the client', async () => {
    const response = await createTask(rahul, {
      title: 'Off client assignment',
      clientId: clientId.toString(),
      assigneeId: outsider.id.toString(),
    });
    expect(response.status).toBe(403);
  });
});

describe('attachments', () => {
  it('accepts documents that belong to the task client', async () => {
    const documentId = await makeDocument(clientId, rahul.id);
    const task = await makeTask({ assignee: rahul.id, client: clientId, title: 'With files' });
    const response = await request(app())
      .patch(`/api/v1/tasks/${task.toString()}`)
      .set(auth(rahul))
      .send({ attachments: [documentId.toString()] });
    expect(response.status).toBe(200);
  });

  it('refuses a document belonging to a different client', async () => {
    const other = await makeClient({ displayName: 'Other Client' });
    await assignStaff(other, [rahul.id]);
    const foreign = await makeDocument(other, rahul.id);
    const task = await makeTask({ assignee: rahul.id, client: clientId, title: 'With files' });

    const response = await request(app())
      .patch(`/api/v1/tasks/${task.toString()}`)
      .set(auth(rahul))
      .send({ attachments: [foreign.toString()] });
    expect(response.status).toBe(400);
  });
});

describe('status transitions', () => {
  it('stamps completedAt on done and clears it on the way back', async () => {
    const task = await makeTask({ assignee: rahul.id, client: clientId, title: 'Finish me' });

    const done = await request(app())
      .post(`/api/v1/tasks/${task.toString()}/status`)
      .set(auth(rahul))
      .send({ status: 'done' });
    expect(done.status).toBe(200);
    expect(await Task.findById(task).then((row) => row?.completedAt)).not.toBeNull();

    const reopened = await request(app())
      .post(`/api/v1/tasks/${task.toString()}/status`)
      .set(auth(rahul))
      .send({ status: 'in_progress' });
    expect(reopened.status).toBe(200);
    expect(await Task.findById(task).then((row) => row?.completedAt)).toBeNull();
  });
});

describe('internal work', () => {
  it('lets a staff member create a task for themselves with no client', async () => {
    const response = await createTask(rahul, {
      title: 'Tidy the shared drive',
      assigneeId: rahul.id.toString(),
    });
    expect(response.status).toBe(201);
    expect((response.body.data as { client: unknown }).client).toBeNull();
  });

  it('refuses a staff member creating internal work for someone else', async () => {
    const response = await createTask(rahul, {
      title: 'Someone else problem',
      assigneeId: sana.id.toString(),
    });
    expect(response.status).toBe(403);
  });
});

describe('comments never reach a client', () => {
  it('has no route a client account can call', async () => {
    const client = await createAccount({ role: 'client' });
    const { User } = await import('../../src/models/user.model.js');
    await User.updateOne({ _id: client.id }, { $set: { linkedClients: [clientId] } }).exec();
    const task = await makeTask({ assignee: rahul.id, client: clientId, title: 'Has comments' });

    const response = await request(app())
      .get(`/api/v1/tasks/${task.toString()}/comments`)
      .set({ ...auth(client), 'X-Active-Client': clientId.toString() });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
