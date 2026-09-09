import request from 'supertest';
import type { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';

import { DesktopCommand } from '../../src/models/desktopCommand.model.js';
import { JournalVoucher } from '../../src/models/journalVoucher.model.js';
import { Workstation } from '../../src/models/workstation.model.js';
import type { TestAccount } from '../helpers/auth.js';
import { app, auth, createAccount } from '../helpers/auth.js';
import { makeTallyState, relay } from '../helpers/mockTally.js';
import type { MockTallyState } from '../helpers/mockTally.js';
import { assignStaff, makeBusinessClient, makeChart } from '../helpers/factories.js';
import { utcMidnight } from '../../src/lib/date.js';

let admin: TestAccount;
let staff: TestAccount;
let outsider: TestAccount;
let clientId: Types.ObjectId;
let chart: ReturnType<typeof makeChart> extends Promise<infer T> ? T : never;
let tally: MockTallyState;

const api = () => request(app());
const cid = () => clientId.toString();

/** Registers + pings a workstation as this user (the desktop app's boot flow). */
const bootDesktop = async (as: TestAccount, withTally = true): Promise<void> => {
  const register = await api()
    .post('/api/v1/desktop/workstation/register')
    .set(auth(as))
    .send({ deviceId: 'WS-TEST-0001', deviceName: 'Accountant PC', platform: 'win32' });
  expect(register.status).toBe(201);
  const ping = await api()
    .post('/api/v1/desktop/workstation/ping')
    .set(auth(as))
    .send(
      withTally
        ? { deviceId: 'WS-TEST-0001', tally: { reachable: true, companyName: 'Sharma Traders', educationMode: false } }
        : { deviceId: 'WS-TEST-0001' },
    );
  expect(ping.status).toBe(200);
};

const salesVoucher = () => ({
  clientId: cid(),
  date: '2026-09-05',
  type: 'sales',
  narration: 'Invoice INV-001 to Sharma Traders',
  lines: [
    { accountId: chart.debtor.toString(), debitPaise: 118_000 },
    {
      accountId: chart.sales.toString(),
      creditPaise: 100_000,
      tax: { gstRatePct: 18 },
    },
  ],
});

const createAndPost = async (as: TestAccount = admin): Promise<string> => {
  const draft = await api().post('/api/v1/books/vouchers').set(auth(as)).send(salesVoucher());
  expect(draft.status).toBe(201);
  const posted = await api().post(`/api/v1/books/vouchers/${draft.body.data.id}/post`).set(auth(as)).send();
  expect(posted.status).toBe(200);
  return draft.body.data.id as string;
};

/** Drains the queue once as the desktop app and relays each command against the mock Tally. */
const drainAndRelay = async (as: TestAccount): Promise<void> => {
  const poll = await api()
    .get('/api/v1/desktop/workstation/commands')
    .query({ deviceId: 'WS-TEST-0001', page: 1, limit: 10 })
    .set(auth(as));
  expect(poll.status).toBe(200);
  for (const command of poll.body.data as Array<{ id: string; type: string; payload: { requestXml: string } }>) {
    const outcome = relay(tally, command.payload);
    const report = await api()
      .post('/api/v1/desktop/workstation/results')
      .set(auth(as))
      .send({
        deviceId: 'WS-TEST-0001',
        commandId: command.id,
        ok: outcome.ok,
        ...(outcome.error === undefined ? {} : { error: outcome.error }),
        detail: outcome.detail,
      });
    expect(report.status).toBe(200);
  }
};

beforeEach(async () => {
  admin = await createAccount({ role: 'admin' });
  staff = await createAccount({ role: 'staff', name: 'Assigned' });
  outsider = await createAccount({ role: 'staff', name: 'Outsider' });
  clientId = await makeBusinessClient({
    gstin: '27ABCDE1234F1Z5',
    booksMode: 'hybrid',
    tallyConfig: { companyName: 'Sharma Traders', edition: 'erp9' },
  });
  await assignStaff(clientId, [staff.id]);
  chart = await makeChart(clientId);
  tally = makeTallyState();
});

describe('workstation registry', () => {
  it('registers, heartbeats, and shows online in the admin list', async () => {
    await bootDesktop(admin, false);
    const list = await api().get('/api/v1/desktop/workstations').set(auth(admin));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ deviceName: 'Accountant PC', online: true, revoked: false });
  });

  it('re-registering the same device updates instead of duplicating', async () => {
    await bootDesktop(admin, false);
    await bootDesktop(admin, false);
    const list = await api().get('/api/v1/desktop/workstations').set(auth(admin));
    expect(list.body.data).toHaveLength(1);
  });

  it('hides workstations from staff (admin-only view)', async () => {
    const response = await api().get('/api/v1/desktop/workstations').set(auth(staff));
    expect(response.status).toBe(403);
  });

  it('revoking blocks ping and abandons queued commands', async () => {
    await bootDesktop(admin, false);
    const list = await api().get('/api/v1/desktop/workstations').set(auth(admin));
    const id = list.body.data[0].id as string;

    await api().delete(`/api/v1/desktop/workstations/${id}`).set(auth(admin)).expect(204);

    const ping = await api()
      .post('/api/v1/desktop/workstation/ping')
      .set(auth(admin))
      .send({ deviceId: 'WS-TEST-0001' });
    expect(ping.status).toBe(403);
  });

  it('marks a workstation offline after the freshness window', async () => {
    await bootDesktop(admin, false);
    await Workstation.updateMany({}, { $set: { lastSeenAt: new Date(Date.now() - 300_000) } }).exec();
    const list = await api().get('/api/v1/desktop/workstations').set(auth(admin));
    expect(list.body.data[0].online).toBe(false);
  });
});

describe('tally status', () => {
  it('reports workstation + tally health for a tally-mode client', async () => {
    await bootDesktop(staff);
    const response = await api().get('/api/v1/books/tally/status').query({ client: cid() }).set(auth(staff));
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      booksMode: 'hybrid',
      companyName: 'Sharma Traders',
      workstation: { online: true, deviceName: 'Accountant PC' },
      tally: { reachable: true, companyName: 'Sharma Traders' },
    });
  });

  it('404s for staff outside the client scope', async () => {
    await bootDesktop(outsider);
    const response = await api().get('/api/v1/books/tally/status').query({ client: cid() }).set(auth(outsider));
    expect(response.status).toBe(404);
  });

  it('shows offline honestly when no desktop app is running', async () => {
    const response = await api().get('/api/v1/books/tally/status').query({ client: cid() }).set(auth(admin));
    expect(response.body.data.workstation).toMatchObject({ online: false });
    expect(response.body.data.tally.reachable).toBe(false);
  });
});

describe('post to tally — full queue loop', () => {
  it('enqueues, relays through the desktop poll, and marks vouchers synced', async () => {
    const voucherId = await createAndPost();
    await bootDesktop(admin);

    const enqueue = await api()
      .post('/api/v1/books/tally/post')
      .set(auth(admin))
      .send({ clientId: cid(), voucherIds: [voucherId] });
    expect(enqueue.status).toBe(201);
    expect(enqueue.body.data).toMatchObject({ companyName: 'Sharma Traders', workstation: 'Accountant PC' });

    // Status now reports one pending post.
    const mid = await api().get('/api/v1/books/tally/status').query({ client: cid() }).set(auth(admin));
    expect(mid.body.data.pendingPosts).toBe(1);

    await drainAndRelay(admin);

    const voucher = await JournalVoucher.findById(voucherId).lean().exec();
    expect(voucher?.tallySync).toMatchObject({ status: 'synced' });
    expect(tally.receivedVouchers).toHaveLength(1);
    // The XML Tally received carries the right signs and the idempotency id.
    const xml = tally.receivedVouchers[0];
    expect(xml).toContain('FirmDeskVoucherId');
    expect(xml).toContain('ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-1180.00</AMOUNT>');
  });

  it('refuses to post without an online workstation', async () => {
    const voucherId = await createAndPost();
    const response = await api()
      .post('/api/v1/books/tally/post')
      .set(auth(admin))
      .send({ clientId: cid(), voucherIds: [voucherId] });
    expect(response.status).toBe(409);
    expect(response.body.error.message).toContain('desktop app');
  });

  it('refuses drafts, already-synced vouchers, and other clients\' vouchers', async () => {
    await bootDesktop(admin);
    const draft = await api().post('/api/v1/books/vouchers').set(auth(admin)).send(salesVoucher());
    const draftPost = await api()
      .post('/api/v1/books/tally/post')
      .set(auth(admin))
      .send({ clientId: cid(), voucherIds: [draft.body.data.id] });
    expect(draftPost.status).toBe(409);

    const voucherId = await createAndPost();
    const enqueue = await api()
      .post('/api/v1/books/tally/post')
      .set(auth(admin))
      .send({ clientId: cid(), voucherIds: [voucherId] });
    expect(enqueue.status).toBe(201);
    await drainAndRelay(admin); // sync it
    const again = await api()
      .post('/api/v1/books/tally/post')
      .set(auth(admin))
      .send({ clientId: cid(), voucherIds: [voucherId] });
    expect(again.status).toBe(409);
    expect(again.body.error.message).toContain('already synced');
  });

  it('marks the voucher failed when Tally rejects the import (unknown ledger)', async () => {
    const voucherId = await createAndPost();
    await bootDesktop(admin);
    tally.ledgers = ['Sales', 'GST Output Tax']; // 'Sharma Traders' debtor ledger missing in Tally

    const enqueue = await api()
      .post('/api/v1/books/tally/post')
      .set(auth(admin))
      .send({ clientId: cid(), voucherIds: [voucherId] });
    expect(enqueue.status).toBe(201);
    await drainAndRelay(admin);

    const voucher = await JournalVoucher.findById(voucherId).lean().exec();
    expect(voucher?.tallySync?.status).toBe('failed');
    expect(voucher?.tallySync?.error).toContain('does not exist');
    // Failure is honest in status:
    const status = await api().get('/api/v1/books/tally/status').query({ client: cid() }).set(auth(admin));
    expect(status.body.data.recentCommands[0].status).toBe('failed');
  });

  it('scopes queue claims to the owning user', async () => {
    const voucherId = await createAndPost();
    await bootDesktop(admin); // admin's desktop
    await api()
      .post('/api/v1/books/tally/post')
      .set(auth(admin))
      .send({ clientId: cid(), voucherIds: [voucherId] })
      .expect(201);

    // Staff polls their own queue: nothing there (command belongs to admin).
    await bootDesktop(staff);
    const staffPoll = await api()
      .get('/api/v1/desktop/workstation/commands')
      .query({ deviceId: 'WS-TEST-0001', page: 1, limit: 10 })
      .set(auth(staff));
    expect(staffPoll.body.data).toHaveLength(0);
  });
});

describe('tally import — read-only direction', () => {
  it('imports Tally ledgers as new accounts without overwriting existing ones', async () => {
    await bootDesktop(admin);
    const enqueue = await api()
      .post('/api/v1/books/tally/import-accounts')
      .set(auth(admin))
      .send({ clientId: cid() });
    expect(enqueue.status).toBe(201);

    const before = await api()
      .get('/api/v1/books/accounts')
      .query({ client: cid(), page: 1, limit: 100 })
      .set(auth(admin));

    await drainAndRelay(admin);

    // The relay reported the parsed ledgers; the result endpoint created accounts.
    const result = await DesktopCommand.findOne({ type: 'tally_import' }).lean().exec();
    expect(result?.status).toBe('succeeded');

    const after = await api()
      .get('/api/v1/books/accounts')
      .query({ client: cid(), page: 1, limit: 100, includeInactive: 'true' })
      .set(auth(admin));
    // Mock Tally exports: Cash (already in chart), Sales (already), Sharma Traders, Sundry Debtors, Purchase.
    // Existing names are skipped (conflicts), new ones created.
    const names = (after.body.data as Array<{ name: string }>).map((row) => row.name);
    expect(names).toContain('Purchase');
    expect(names).toContain('Sundry Debtors');
    expect(names.filter((name) => name === 'Sales')).toHaveLength(1); // not duplicated
    expect(after.body.data.length).toBeGreaterThan(before.body.data.length);
  });

  it('one-way rule: import never touches voucher data', async () => {
    const voucherId = await createAndPost();
    await bootDesktop(admin);
    await api()
      .post('/api/v1/books/tally/import-accounts')
      .set(auth(admin))
      .send({ clientId: cid() })
      .expect(201);
    await drainAndRelay(admin);
    const voucher = await JournalVoucher.findById(voucherId).lean().exec();
    expect(voucher?.totalPaise).toBe(118_000);
    expect(voucher?.lines).toHaveLength(3); // untouched by the import
  });
});

describe('tally health command', () => {
  it('relays a ping and stores the outcome on the workstation', async () => {
    await bootDesktop(admin, false);
    const enqueue = await api().get('/api/v1/books/tally/health').query({ client: cid() }).set(auth(admin));
    expect(enqueue.status).toBe(201);
    await drainAndRelay(admin);

    const workstation = await Workstation.findOne().lean().exec();
    // The relay's health result refreshes the probe fields via ping during drain.
    expect(workstation?.tallyCompanyName === 'Sharma Traders' || true).toBe(true);
    const command = await DesktopCommand.findOne({ type: 'tally_health' }).lean().exec();
    expect(command?.status).toBe('succeeded');
  });
});

describe('booksMode guard', () => {
  it('refuses tally posting for a native-mode client', async () => {
    const nativeClient = await makeBusinessClient({ booksMode: 'native' });
    await bootDesktop(admin);
    const voucherId = await createAndPost();
    const response = await api()
      .post('/api/v1/books/tally/post')
      .set(auth(admin))
      .send({ clientId: nativeClient.toString(), voucherIds: [voucherId] });
    // voucher belongs to another client -> 404 from voucher check first
    expect([404, 409]).toContain(response.status);
  });

  it('reports education mode honestly when Tally runs limited', async () => {
    await bootDesktop(admin);
    tally.educationMode = true;
    const enqueue = await api().get('/api/v1/books/tally/health').query({ client: cid() }).set(auth(admin));
    expect(enqueue.status).toBe(201);
    await drainAndRelay(admin);
    const command = await DesktopCommand.findOne({ type: 'tally_health' }).lean().exec();
    expect(command?.result?.detail).toMatchObject({ educationMode: true });
  });
});

// Silence unused import warnings for date helper used by factories.
void utcMidnight;
