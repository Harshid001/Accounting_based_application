import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { capturedMail, clearCapturedMail, mailTransport } from '../../src/config/mailer.js';
import { User } from '../../src/models/user.model.js';
import { app, auth, createAccount, uniqueEmail, STRONG_PASSWORD } from '../helpers/auth.js';

const signUp = (email: string, password = STRONG_PASSWORD) =>
  request(app())
    .post('/api/auth/sign-up/email')
    .set('Content-Type', 'application/json')
    .send({ email, password, name: 'New Person' });

const linkFromMail = (text: string): URL => {
  const match = text.match(/https?:\/\/\S+/);
  if (!match) throw new Error('captured email did not contain a link');
  return new URL(match[0]);
};

beforeEach(() => {
  clearCapturedMail();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('health', () => {
  it('answers with liveness only and no version or dependency detail', async () => {
    const response = await request(app()).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(Object.keys(response.body.data as Record<string, unknown>).sort()).toEqual([
      'db',
      'status',
      'uptime',
    ]);
    expect(JSON.stringify(response.body)).not.toContain('version');
  });
});

describe('sign-up', () => {
  it('creates exactly one unverified client and captures one verification email', async () => {
    const email = uniqueEmail('fresh');
    const response = await signUp(email);
    expect(response.status).toBeLessThan(400);

    expect(await User.countDocuments({ email })).toBe(1);
    const record = await User.findOne({ email }).lean().exec();
    expect(record?.role).toBe('client');
    expect(record?.linkedClients).toEqual([]);
    expect(record?.emailVerified).toBe(false);

    expect(capturedMail()).toHaveLength(1);
    expect(capturedMail()[0]).toMatchObject({
      to: email,
      category: 'verification',
    });
    expect(capturedMail()[0]?.text).toContain('expires in 24 hours');
  });

  it('verifies the account through the one-time link in the email', async () => {
    const email = uniqueEmail('verify');
    const response = await signUp(email);
    expect(response.status).toBeLessThan(400);

    const mail = capturedMail()[0];
    if (!mail) throw new Error('verification email was not captured');
    const verificationUrl = linkFromMail(mail.text);
    const verified = await request(app()).get(
      `${verificationUrl.pathname}${verificationUrl.search}`,
    );
    expect(verified.status).toBeGreaterThanOrEqual(300);
    expect(verified.status).toBeLessThan(400);

    const record = await User.findOne({ email }).lean().exec();
    expect(record?.emailVerified).toBe(true);
  });

  it('does not duplicate the user when SMTP permanently rejects the email', async () => {
    const rejected = Object.assign(new Error('SMTP authentication rejected'), {
      code: 'EAUTH',
      responseCode: 535,
      command: 'AUTH PLAIN',
    });
    const send = vi.spyOn(mailTransport, 'send').mockRejectedValue(rejected);
    const email = uniqueEmail('smtp-failed');

    const first = await signUp(email);
    const repeated = await signUp(email);

    expect(first.status).toBeLessThan(400);
    expect(repeated.status).toBeLessThan(400);
    expect(await User.countDocuments({ email })).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('retries a temporary transport failure with one stable message id', async () => {
    const originalSend = mailTransport.send.bind(mailTransport);
    const temporary = Object.assign(new Error('temporary socket failure'), {
      code: 'ESOCKET',
      command: 'CONN',
    });
    const send = vi
      .spyOn(mailTransport, 'send')
      .mockRejectedValueOnce(temporary)
      .mockImplementation(originalSend);
    const email = uniqueEmail('smtp-retry');

    const response = await signUp(email);

    expect(response.status).toBeLessThan(400);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0].messageId).toBe(send.mock.calls[1]?.[0].messageId);
    expect(capturedMail()).toHaveLength(1);
    expect(await User.countDocuments({ email })).toBe(1);
  });

  it('refuses a password that is too short', async () => {
    const response = await signUp(uniqueEmail('weak'), 'short');
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('refuses a password from the common list', async () => {
    const response = await signUp(uniqueEmail('common'), 'passwordpassword');
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('refuses a password containing the email address', async () => {
    const email = 'predictable.person@firmdesk.test';
    const response = await signUp(email, 'predictable.person is my password');
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('cannot set its own role through the sign-up body', async () => {
    const email = uniqueEmail('escalate');
    await request(app())
      .post('/api/auth/sign-up/email')
      .set('Content-Type', 'application/json')
      .send({ email, password: STRONG_PASSWORD, name: 'Sneaky', role: 'admin' });

    const record = await User.findOne({ email }).lean().exec();
    expect(record?.role).toBe('client');
  });
});

describe('the unlinked account', () => {
  it('reaches /me but nothing else', async () => {
    const account = await createAccount({ role: 'client' });

    const me = await request(app()).get('/api/v1/me').set(auth(account));
    expect(me.status).toBe(200);
    expect(me.body.data.unlinked).toBe(true);

    for (const path of [
      '/api/v1/clients',
      '/api/v1/notifications',
      '/api/v1/portal/overview',
    ]) {
      const response = await request(app()).get(path).set(auth(account));
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('ACCOUNT_UNLINKED');
    }
  });
});

describe('the unverified account', () => {
  it('is told to verify rather than being let in', async () => {
    const account = await createAccount({ role: 'staff', emailVerified: false });
    const response = await request(app()).get('/api/v1/clients').set(auth(account));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('EMAIL_UNVERIFIED');
  });
});

describe('the deactivated account', () => {
  it('is unauthenticated on its next request', async () => {
    const account = await createAccount({ role: 'staff' });
    await User.updateOne({ _id: account.id }, { $set: { status: 'deactivated' } }).exec();
    const response = await request(app()).get('/api/v1/clients').set(auth(account));
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('anonymous requests', () => {
  it('are rejected with UNAUTHENTICATED, not a redirect', async () => {
    const response = await request(app()).get('/api/v1/clients');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('carry a request id for support to quote', async () => {
    const response = await request(app()).get('/api/v1/clients');
    expect(typeof response.body.error.requestId).toBe('string');
    expect(response.headers['x-request-id']).toBe(response.body.error.requestId);
  });
});

describe('lockout and enumeration', () => {
  it('rate-limits repeated failed sign-ins for one email', async () => {
    const account = await createAccount({ role: 'staff' });
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await request(app())
        .post('/api/auth/sign-in/email')
        .set('Content-Type', 'application/json')
        .send({ email: account.email, password: 'definitely not the password' });
      statuses.push(response.status);
    }
    expect(statuses[5]).toBe(429);
  });

  it('sends one reset email while answering known and unknown addresses identically', async () => {
    const known = await createAccount({ role: 'staff' });
    const unknown = uniqueEmail('nobody');
    clearCapturedMail();

    const first = await request(app())
      .post('/api/auth/request-password-reset')
      .set('Content-Type', 'application/json')
      .send({ email: known.email, redirectTo: 'http://localhost:5173/reset-password' });
    const second = await request(app())
      .post('/api/auth/request-password-reset')
      .set('Content-Type', 'application/json')
      .send({ email: unknown, redirectTo: 'http://localhost:5173/reset-password' });

    expect(first.status).toBe(second.status);
    expect(JSON.stringify(first.body)).toBe(JSON.stringify(second.body));
    expect(capturedMail()).toHaveLength(1);
    expect(capturedMail()[0]).toMatchObject({
      to: known.email,
      category: 'password_reset',
    });
  });

  it('uses a reset link once and revokes the existing session', async () => {
    const account = await createAccount({ role: 'staff' });
    clearCapturedMail();
    const requested = await request(app())
      .post('/api/auth/request-password-reset')
      .set('Content-Type', 'application/json')
      .send({ email: account.email, redirectTo: 'http://localhost:5173/reset-password' });
    expect(requested.status).toBeLessThan(400);

    const mail = capturedMail()[0];
    if (!mail) throw new Error('password-reset email was not captured');
    const resetUrl = linkFromMail(mail.text);
    const opened = await request(app()).get(`${resetUrl.pathname}${resetUrl.search}`);
    expect(opened.status).toBeGreaterThanOrEqual(300);
    expect(opened.status).toBeLessThan(400);
    const location = opened.headers.location;
    if (typeof location !== 'string') {
      throw new Error('password-reset link did not redirect to the frontend');
    }
    const token = new URL(location).searchParams.get('token');
    if (token === null) throw new Error('password-reset link did not contain a token');

    const reset = await request(app())
      .post('/api/auth/reset-password')
      .set('Content-Type', 'application/json')
      .send({ token, newPassword: 'harbor ledger lantern 73 monsoon' });
    expect(reset.status).toBeLessThan(400);

    const reused = await request(app())
      .post('/api/auth/reset-password')
      .set('Content-Type', 'application/json')
      .send({ token, newPassword: 'river ledger compass 84 monsoon' });
    expect(reused.status).toBeGreaterThanOrEqual(400);

    const oldSession = await request(app()).get('/api/v1/me').set(auth(account));
    expect(oldSession.status).toBe(401);
  });

  it('limits verification resends to five attempts in fifteen minutes', async () => {
    const account = await createAccount({ role: 'client', emailVerified: false });
    clearCapturedMail();
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await request(app())
        .post('/api/auth/send-verification-email')
        .set('Content-Type', 'application/json')
        .send({ email: account.email, callbackURL: 'http://localhost:5173/sign-in' });
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 5).every((status) => status < 429)).toBe(true);
    expect(statuses[5]).toBe(429);
    expect(capturedMail()).toHaveLength(5);
    expect(capturedMail().every((mail) => mail.category === 'verification')).toBe(true);
  });
});

describe('sessions', () => {
  it('lists its own sessions and can end the others', async () => {
    const account = await createAccount({ role: 'staff' });

    const listed = await request(app()).get('/api/v1/me/sessions').set(auth(account));
    expect(listed.status).toBe(200);
    expect((listed.body.data as unknown[]).length).toBeGreaterThanOrEqual(1);
    expect((listed.body.data as Array<{ current: boolean }>).some((row) => row.current)).toBe(
      true,
    );

    const revoked = await request(app()).delete('/api/v1/me/sessions').set(auth(account));
    expect(revoked.status).toBe(204);

    const stillWorks = await request(app()).get('/api/v1/me').set(auth(account));
    expect(stillWorks.status).toBe(200);
  });

  it('gives a client a longer session than a staff member', async () => {
    const staff = await createAccount({ role: 'staff' });
    const client = await createAccount({ role: 'client' });

    const { Session } = await import('../../src/models/session.model.js');
    const staffSession = await Session.findOne({ userId: staff.id })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const clientSession = await Session.findOne({ userId: client.id })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const staffDays = ((staffSession?.expiresAt.getTime() ?? 0) - Date.now()) / 86_400_000;
    const clientDays = ((clientSession?.expiresAt.getTime() ?? 0) - Date.now()) / 86_400_000;

    expect(Math.round(staffDays)).toBe(7);
    expect(Math.round(clientDays)).toBe(30);
  });
});
