import request from 'supertest';
import type { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';

import { Account } from '../../src/models/ledgerAccount.model.js';
import { AuditLog } from '../../src/models/auditLog.model.js';
import { JournalVoucher } from '../../src/models/journalVoucher.model.js';
import type { TestAccount } from '../helpers/auth.js';
import { app, auth, createAccount } from '../helpers/auth.js';
import type { ChartOfAccounts } from '../helpers/factories.js';
import { assignStaff, makeBusinessClient, makeChart } from '../helpers/factories.js';

let admin: TestAccount;
let staff: TestAccount;
let outsider: TestAccount;
let clientId: Types.ObjectId;
let otherClientId: Types.ObjectId;
let chart: ChartOfAccounts;

const api = () => request(app());
const cid = () => clientId.toString();

const salesVoucher = (overrides: Record<string, unknown> = {}) => ({
  clientId: cid(),
  date: '2026-09-05',
  type: 'sales',
  narration: 'Invoice INV-001 to Sharma Traders',
  lines: [
    { accountId: chart.debtor.toString(), debitPaise: 118_000 },
    {
      accountId: chart.sales.toString(),
      creditPaise: 100_000,
      tax: { gstRatePct: 18, hsnSac: '9983', placeOfSupply: '27' },
    },
  ],
  ...overrides,
});

const rentVoucher = (date = '2026-09-10') => ({
  clientId: cid(),
  date,
  type: 'payment',
  narration: 'September rent',
  lines: [
    { accountId: chart.rent.toString(), debitPaise: 50_000 },
    { accountId: chart.bank.toString(), creditPaise: 50_000 },
  ],
});

const createDraft = async (
  body: Record<string, unknown>,
  as: TestAccount = admin,
): Promise<string> => {
  const response = await api().post('/api/v1/books/vouchers').set(auth(as)).send(body);
  expect(response.status).toBe(201);
  return response.body.data.id as string;
};

const post = async (id: string, as: TestAccount = admin) =>
  api().post(`/api/v1/books/vouchers/${id}/post`).set(auth(as)).send();

beforeEach(async () => {
  admin = await createAccount({ role: 'admin' });
  staff = await createAccount({ role: 'staff', name: 'Assigned' });
  outsider = await createAccount({ role: 'staff', name: 'Outsider' });
  clientId = await makeBusinessClient({ gstin: '27ABCDE1234F1Z5' });
  otherClientId = await makeBusinessClient({ gstin: '29ABCDE9876F1Z1' });
  await assignStaff(clientId, [staff.id]);
  chart = await makeChart(clientId);
});

describe('books — accounts', () => {
  it('creates an account and lists it', async () => {
    const created = await api()
      .post('/api/v1/books/accounts')
      .set(auth(admin))
      .send({ clientId: cid(), code: '5002', name: 'Electricity', type: 'expense' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      code: '5002',
      name: 'Electricity',
      isSystem: false,
    });

    const list = await api()
      .get('/api/v1/books/accounts')
      .query({ client: cid(), type: 'expense' })
      .set(auth(staff));
    expect(list.status).toBe(200);
    const codes = list.body.data.map((row: { code: string }) => row.code);
    expect(codes).toContain('5002');
    expect(codes).toContain('5001');
  });

  it('rejects duplicate codes and reserved sub-types', async () => {
    const dup = await api()
      .post('/api/v1/books/accounts')
      .set(auth(admin))
      .send({ clientId: cid(), code: '1001', name: 'Dup', type: 'asset' });
    expect(dup.status).toBe(409);

    const reserved = await api()
      .post('/api/v1/books/accounts')
      .set(auth(admin))
      .send({
        clientId: cid(),
        code: '9999',
        name: 'Fake',
        type: 'liability',
        subType: 'gst_output',
      });
    expect(reserved.status).toBe(400);
  });

  it('hides accounts from staff outside the client scope', async () => {
    const list = await api()
      .get('/api/v1/books/accounts')
      .query({ client: cid() })
      .set(auth(outsider));
    expect(list.status).toBe(404);

    const detail = await api()
      .get(`/api/v1/books/accounts/${chart.cash.toString()}`)
      .set(auth(outsider));
    expect(detail.status).toBe(404);
  });

  it('rejects changing code/type through PATCH', async () => {
    const response = await api()
      .patch(`/api/v1/books/accounts/${chart.cash.toString()}`)
      .set(auth(admin))
      .send({ code: 'X' });
    expect(response.status).toBe(403);
  });
});

describe('books — voucher lifecycle', () => {
  it('drafts a one-line sales entry and materialises the GST duty line', async () => {
    const response = await api()
      .post('/api/v1/books/vouchers')
      .set(auth(staff))
      .send(salesVoucher());
    expect(response.status).toBe(201);
    const data = response.body.data;
    expect(data.status).toBe('draft');
    expect(data.voucherNo).toBeNull();
    expect(data.total.paise).toBe(118_000);
    expect(data.derived.outputTax.paise).toBe(18_000);
    const derived = data.lines.filter((line: { isDerived: boolean }) => line.isDerived);
    expect(derived).toHaveLength(1);
    expect(derived[0].account.subType).toBe('gst_output');
    expect(derived[0].credit.paise).toBe(18_000);

    const system = await Account.find({ client: clientId, isSystem: true }).lean().exec();
    expect(system).toHaveLength(5);
  });

  it('rejects an unbalanced draft', async () => {
    const response = await api()
      .post('/api/v1/books/vouchers')
      .set(auth(admin))
      .send(
        salesVoucher({
          lines: [
            { accountId: chart.debtor.toString(), debitPaise: 100_000 },
            { accountId: chart.sales.toString(), creditPaise: 90_000 },
          ],
        }),
      );
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects accounts belonging to another client', async () => {
    const foreign = await makeChart(otherClientId);
    const response = await api()
      .post('/api/v1/books/vouchers')
      .set(auth(admin))
      .send(
        salesVoucher({
          lines: [
            { accountId: foreign.debtor.toString(), debitPaise: 100 },
            { accountId: chart.sales.toString(), creditPaise: 100 },
          ],
        }),
      );
    expect(response.status).toBe(400);
  });

  it('rejects direct writes to status/voucherNo', async () => {
    const response = await api()
      .post('/api/v1/books/vouchers')
      .set(auth(admin))
      .send(salesVoucher({ status: 'posted' }));
    expect(response.status).toBe(403);
  });

  it('posts a draft, assigns a sequential number, and freezes it', async () => {
    const first = await createDraft(salesVoucher());
    const second = await createDraft(rentVoucher());

    const posted1 = await post(first, staff);
    expect(posted1.status).toBe(200);
    expect(posted1.body.data.status).toBe('posted');
    expect(posted1.body.data.voucherNo).toBe('JV/2026-27/00001');
    expect(posted1.body.data.postedAt).not.toBeNull();

    const posted2 = await post(second);
    expect(posted2.body.data.voucherNo).toBe('JV/2026-27/00002');

    const again = await post(first);
    expect(again.status).toBe(409);

    const edit = await api()
      .patch(`/api/v1/books/vouchers/${first}`)
      .set(auth(admin))
      .send({ narration: 'tamper' });
    expect(edit.status).toBe(409);

    const del = await api().delete(`/api/v1/books/vouchers/${first}`).set(auth(admin));
    expect(del.status).toBe(409);

    const audit = await AuditLog.find({ entityKind: 'journalVoucher', action: 'post' })
      .lean()
      .exec();
    expect(audit).toHaveLength(2);
  });

  it('does not consume a number when a draft is deleted', async () => {
    const doomed = await createDraft(rentVoucher());
    const kept = await createDraft(salesVoucher());
    const del = await api().delete(`/api/v1/books/vouchers/${doomed}`).set(auth(admin));
    expect(del.status).toBe(204);
    const posted = await post(kept);
    expect(posted.body.data.voucherNo).toBe('JV/2026-27/00001');
  });

  it('only admins delete drafts; staff cannot', async () => {
    const draft = await createDraft(rentVoucher());
    const response = await api().delete(`/api/v1/books/vouchers/${draft}`).set(auth(staff));
    expect(response.status).toBe(403);
  });

  it('re-validates against the chart at post time (inactive account blocks posting)', async () => {
    const draft = await createDraft(rentVoucher());
    await Account.updateOne({ _id: chart.rent }, { $set: { isActive: false } }).exec();
    const response = await post(draft);
    expect(response.status).toBe(400);
    const stillDraft = await JournalVoucher.findById(draft).lean().exec();
    expect(stillDraft?.status).toBe('draft');
  });

  it('reverses a posted voucher via a mirrored draft and flips the original on post', async () => {
    const id = await createDraft(salesVoucher());
    await post(id);

    const reversal = await api()
      .post(`/api/v1/books/vouchers/${id}/reverse`)
      .set(auth(staff))
      .send({ reason: 'Invoice cancelled by customer', date: '2026-09-20' });
    expect(reversal.status).toBe(201);
    const rev = reversal.body.data;
    expect(rev.status).toBe('draft');
    expect(rev.source).toBe('reversal');
    expect(rev.reversalOf).toBe(id);
    expect(rev.total.paise).toBe(118_000);
    const debtorLine = rev.lines.find(
      (line: { account: { id: string } }) => line.account.id === chart.debtor.toString(),
    );
    expect(debtorLine.credit.paise).toBe(118_000);

    const dupe = await api()
      .post(`/api/v1/books/vouchers/${id}/reverse`)
      .set(auth(admin))
      .send({ reason: 'again' });
    expect(dupe.status).toBe(409);

    const posted = await post(rev.id);
    expect(posted.status).toBe(200);
    expect(posted.body.data.voucherNo).toBe('JV/2026-27/00002');

    const original = await api().get(`/api/v1/books/vouchers/${id}`).set(auth(admin));
    expect(original.body.data.status).toBe('reversed');
    expect(original.body.data.reversedBy).toBe(rev.id);

    const tb = await api()
      .get('/api/v1/books/trial-balance')
      .query({ client: cid() })
      .set(auth(admin));
    const rows = tb.body.data.groups.flatMap((group: { rows: unknown[] }) => group.rows);
    const debtor = rows.find((row: { code: string }) => row.code === '1101');
    expect(debtor.balance.paise).toBe(0);
  });

  it('refuses to reverse a draft', async () => {
    const draft = await createDraft(rentVoucher());
    const response = await api()
      .post(`/api/v1/books/vouchers/${draft}/reverse`)
      .set(auth(admin))
      .send({ reason: 'nope' });
    expect(response.status).toBe(409);
  });

  it('scopes voucher access by assignment', async () => {
    const draft = await createDraft(rentVoucher());
    const detail = await api().get(`/api/v1/books/vouchers/${draft}`).set(auth(outsider));
    expect(detail.status).toBe(404);
    const attempt = await post(draft, outsider);
    expect(attempt.status).toBe(404);
    const list = await api()
      .get('/api/v1/books/vouchers')
      .query({ client: cid() })
      .set(auth(outsider));
    expect(list.status).toBe(404);
  });
});

describe('books — period locks', () => {
  it('requires typed confirmation and admin role', async () => {
    const wrong = await api()
      .post('/api/v1/books/periods/2026-09/lock')
      .set(auth(admin))
      .send({ clientId: cid(), confirm: 'yes' });
    expect(wrong.status).toBe(400);

    const staffTry = await api()
      .post('/api/v1/books/periods/2026-09/lock')
      .set(auth(staff))
      .send({ clientId: cid(), confirm: 'LOCK 2026-09' });
    expect(staffTry.status).toBe(403);
  });

  it('refuses to lock while drafts remain in the period', async () => {
    await createDraft(rentVoucher('2026-09-10'));
    const response = await api()
      .post('/api/v1/books/periods/2026-09/lock')
      .set(auth(admin))
      .send({ clientId: cid(), confirm: 'LOCK 2026-09' });
    expect(response.status).toBe(409);
  });

  it('locks a month, marks posted vouchers locked, and blocks posting into it', async () => {
    const posted = await createDraft(rentVoucher('2026-09-10'));
    await post(posted);

    const lock = await api()
      .post('/api/v1/books/periods/2026-09/lock')
      .set(auth(admin))
      .send({ clientId: cid(), confirm: 'LOCK 2026-09', note: 'GSTR-3B filed' });
    expect(lock.status).toBe(201);
    expect(lock.body.data).toMatchObject({ period: '2026-09', kind: 'monthly' });

    const locked = await JournalVoucher.findById(posted).lean().exec();
    expect(locked?.status).toBe('locked');

    const lateDraft = await createDraft(rentVoucher('2026-09-25'));
    const attempt = await post(lateDraft);
    expect(attempt.status).toBe(409);
    expect(attempt.body.error.message).toContain('locked');

    const octoberDraft = await createDraft(rentVoucher('2026-10-01'));
    const ok = await post(octoberDraft);
    expect(ok.status).toBe(200);

    const relock = await api()
      .post('/api/v1/books/periods/2026-09/lock')
      .set(auth(admin))
      .send({ clientId: cid(), confirm: 'LOCK 2026-09' });
    expect(relock.status).toBe(409);
  });

  it('dates a reversal of a locked voucher into the earliest open period', async () => {
    const id = await createDraft(salesVoucher({ date: '2026-09-05' }));
    await post(id);
    await api()
      .post('/api/v1/books/periods/2026-09/lock')
      .set(auth(admin))
      .send({ clientId: cid(), confirm: 'LOCK 2026-09' });

    const reversal = await api()
      .post(`/api/v1/books/vouchers/${id}/reverse`)
      .set(auth(admin))
      .send({ reason: 'Filed wrong', date: '2026-09-15' });
    expect(reversal.status).toBe(201);
    expect(reversal.body.data.date).toBe('2026-10-01');

    const posted = await post(reversal.body.data.id);
    expect(posted.status).toBe(200);
  });

  it('locks a full financial year', async () => {
    const lock = await api()
      .post('/api/v1/books/periods/2026-27/lock')
      .set(auth(admin))
      .send({ clientId: cid(), confirm: 'LOCK 2026-27' });
    expect(lock.status).toBe(201);
    expect(lock.body.data).toMatchObject({
      period: 'FY 2026-27',
      kind: 'fy',
      periodStart: '2026-04-01',
      periodEnd: '2027-03-31',
    });
    const list = await api()
      .get('/api/v1/books/periods')
      .query({ client: cid() })
      .set(auth(staff));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
  });
});

describe('books — reports', () => {
  beforeEach(async () => {
    await post(await createDraft(salesVoucher({ date: '2026-09-05' })));
    await post(await createDraft(rentVoucher('2026-09-10')));
    // A receipt: debtor pays 1,18,000 into bank.
    await post(
      await createDraft({
        clientId: cid(),
        date: '2026-09-20',
        type: 'receipt',
        lines: [
          { accountId: chart.bank.toString(), debitPaise: 118_000 },
          { accountId: chart.debtor.toString(), creditPaise: 118_000 },
        ],
      }),
    );
    // One draft that must not affect balances by default.
    await createDraft(rentVoucher('2026-09-28'));
  });

  it('produces a balanced trial balance excluding drafts', async () => {
    const response = await api()
      .get('/api/v1/books/trial-balance')
      .query({ client: cid(), asOf: '2026-09-30' })
      .set(auth(staff));
    expect(response.status).toBe(200);
    const tb = response.body.data;
    expect(tb.balanced).toBe(true);
    expect(tb.totals.debit.paise).toBe(tb.totals.credit.paise);

    const rows = tb.groups.flatMap((group: { rows: unknown[] }) => group.rows);
    const byCode = (code: string) => rows.find((row: { code: string }) => row.code === code);
    expect(byCode('1002').balance).toMatchObject({ paise: 68_000, side: 'Dr' }); // 118,000 - 50,000
    expect(byCode('1101').balance.paise).toBe(0);
    expect(byCode('4001').balance).toMatchObject({ paise: 100_000, side: 'Cr' });
    expect(byCode('5001').balance).toMatchObject({ paise: 50_000, side: 'Dr' });
    expect(byCode('SYS-GST-OUT').balance).toMatchObject({ paise: 18_000, side: 'Cr' });
  });

  it('includes drafts when asked', async () => {
    const response = await api()
      .get('/api/v1/books/trial-balance')
      .query({ client: cid(), includeDrafts: 'true' })
      .set(auth(admin));
    const rows = response.body.data.groups.flatMap((group: { rows: unknown[] }) => group.rows);
    const rent = rows.find((row: { code: string }) => row.code === '5001');
    expect(rent.balance.paise).toBe(100_000);
    expect(response.body.data.balanced).toBe(true);
  });

  it('renders a ledger with a running balance and opening carried forward', async () => {
    const response = await api()
      .get('/api/v1/books/ledger')
      .query({ client: cid(), account: chart.bank.toString(), from: '2026-09-15' })
      .set(auth(staff));
    expect(response.status).toBe(200);
    const statement = response.body.data;
    expect(statement.account.code).toBe('1002');
    // Rent on the 10th is before the window -> opening is 50,000 Cr (overdrawn).
    expect(statement.opening).toMatchObject({ paise: 50_000, side: 'Cr' });
    expect(statement.entries).toHaveLength(1);
    expect(statement.entries[0].debit.paise).toBe(118_000);
    expect(statement.entries[0].balance).toMatchObject({ paise: 68_000, side: 'Dr' });
    expect(statement.closing).toMatchObject({ paise: 68_000, side: 'Dr' });
    expect(response.body.meta.total).toBe(1);
  });

  it('lists the day book in chronological order', async () => {
    const response = await api()
      .get('/api/v1/books/day-book')
      .query({ client: cid(), from: '2026-09-01', to: '2026-09-30' })
      .set(auth(admin));
    expect(response.status).toBe(200);
    const dates = response.body.data.map((row: { date: string }) => row.date);
    expect(dates).toEqual(['2026-09-05', '2026-09-10', '2026-09-20']);
    expect(response.body.data[0].voucherNo).toBe('JV/2026-27/00001');
  });

  it('exports the trial balance as CSV', async () => {
    const response = await api()
      .get('/api/v1/books/trial-balance/export')
      .query({ client: cid() })
      .set(auth(admin));
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('Sales');
    expect(response.text).toContain('1000.00');
  });

  it('reports books status', async () => {
    const response = await api()
      .get('/api/v1/books/status')
      .query({ client: cid() })
      .set(auth(staff));
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      booksMode: 'native',
      vouchers: { draft: 1, posted: 3 },
    });
    expect(response.body.data.accounts).toBe(11); // 6 chart + 5 system
  });

  it('blocks outsiders from reports', async () => {
    const tb = await api()
      .get('/api/v1/books/trial-balance')
      .query({ client: cid() })
      .set(auth(outsider));
    expect(tb.status).toBe(404);
  });
});

describe('client booksMode', () => {
  it('requires tally config for tally/hybrid modes and exposes booksMode on the client', async () => {
    const bad = await api()
      .patch(`/api/v1/clients/${cid()}`)
      .set(auth(admin))
      .send({ booksMode: 'tally' });
    expect(bad.status).toBe(400);

    const good = await api()
      .patch(`/api/v1/clients/${cid()}`)
      .set(auth(admin))
      .send({
        booksMode: 'tally',
        tallyConfig: { companyName: 'Sharma Traders', edition: 'erp9' },
      });
    expect(good.status).toBe(200);
    expect(good.body.data.booksMode).toBe('tally');
    expect(good.body.data.tallyConfig.edition).toBe('erp9');

    const staffTry = await api()
      .patch(`/api/v1/clients/${cid()}`)
      .set(auth(staff))
      .send({ booksMode: 'native' });
    expect(staffTry.status).toBe(403);
  });
});
