import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { Types } from 'mongoose';

import { getDb } from '../../src/config/db.js';
import { Session } from '../../src/models/session.model.js';
import { app, createAccount, uniqueEmail } from '../helpers/auth.js';

const DESKTOP_HEADERS = {
  'Content-Type': 'application/json',
  Origin: 'http://tauri.localhost',
  'X-FirmDesk-Shell': 'desktop',
};

const WEB_HEADERS = { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' };

/**
 * Desktop Google sign-in handoff (betterAuth.routes.ts). The test environment
 * has no Google provider configured, which is itself part of the contract:
 * start must refuse cleanly rather than mint anything. The handoff happy path
 * is exercised from the session side: a real better-auth session (created via
 * the email flow) is bound to a one-time key exactly as /callback/google's
 * landing page would do, then exchanged and validated end to end.
 */
describe('desktop google handoff', () => {
  beforeEach(async () => {
    await getDb().collection('desktop_auth_handoff').deleteMany({});
  });

  describe('POST /api/auth/desktop/google/start', () => {
    it('returns the Google consent URL for the desktop shell — never a session', async () => {
      const response = await request(app())
        .post('/api/auth/desktop/google/start')
        .set(DESKTOP_HEADERS)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.url).toMatch(/^https:\/\/(accounts\.google\.com|www\.google\.com)\//);
      // The start point must never hand out credentials.
      expect(response.body.token).toBeUndefined();
      expect(response.body.user).toBeUndefined();

      // And no session exists yet — Google has not validated anything.
      expect(await Session.countDocuments()).toBe(0);
    });

    it('is not reachable from a plain web origin', async () => {
      const response = await request(app())
        .post('/api/auth/desktop/google/start')
        .set(WEB_HEADERS)
        .send({});

      expect(response.status).toBe(403);
      expect(response.body?.url).toBeUndefined();
    });
  });

  describe('POST /api/auth/desktop/google/exchange', () => {
    it('rejects a malformed key without touching sessions', async () => {
      const before = await Session.countDocuments();
      const response = await request(app())
        .post('/api/auth/desktop/google/exchange')
        .set(DESKTOP_HEADERS)
        .send({ key: 'short' });

      expect(response.status).toBe(401);
      expect(await Session.countDocuments()).toBe(before);
    });

    it('rejects an unknown key (one-time keys are unguessable)', async () => {
      const response = await request(app())
        .post('/api/auth/desktop/google/exchange')
        .set(DESKTOP_HEADERS)
        .send({
          key: 'a'.repeat(64),
        });

      expect(response.status).toBe(401);
    });

    it('is not reachable from a plain web origin', async () => {
      const response = await request(app())
        .post('/api/auth/desktop/google/exchange')
        .set(WEB_HEADERS)
        .send({ key: 'a'.repeat(64) });

      expect(response.status).toBe(403);
    });

    it('exchanges a valid one-time key for cookie + bearer and consumes the key', async () => {
      const account = await createAccount({ role: 'admin', email: uniqueEmail('desktop-admin') });

      const sessionDoc = await Session.findOne({
        userId: account.id,
      })
        .sort({ createdAt: -1 })
        .exec();
      if (!sessionDoc) throw new Error('expected a session for the test account');

      // Mint the handoff exactly as /desktop/google/complete does.
      const { randomBytes, createHash } = await import('node:crypto');
      const key = randomBytes(32).toString('base64url');
      await getDb().collection('desktop_auth_handoff').insertOne({
        keyHash: createHash('sha256').update(key).digest('hex'),
        sessionId: sessionDoc._id as Types.ObjectId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      const response = await request(app())
        .post('/api/auth/desktop/google/exchange')
        .set(DESKTOP_HEADERS)
        .send({ key });

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        email: account.email.toLowerCase(),
        role: 'admin',
      });
      expect(typeof response.body.token).toBe('string');

      const setCookie = response.headers['set-cookie'] as unknown;
      const cookieText = Array.isArray(setCookie) ? setCookie.join('\n') : String(setCookie ?? '');
      expect(cookieText).toContain('better-auth.session_token=');
      expect(cookieText).toContain('HttpOnly');

      // The issued credentials must actually authenticate.
      const me = await request(app())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${response.body.token}`);
      expect(me.status).toBe(200);

      // One-time: the same key never works twice.
      const replay = await request(app())
        .post('/api/auth/desktop/google/exchange')
        .set(DESKTOP_HEADERS)
        .send({ key });
      expect(replay.status).toBe(401);

      // And the collection no longer holds the handoff.
      expect(
        await getDb().collection('desktop_auth_handoff').countDocuments({}),
      ).toBe(0);
    });

    it('refuses a handoff whose session expired', async () => {
      const account = await createAccount({ email: uniqueEmail('expired-handoff') });
      const sessionDoc = await Session.findOne({ userId: account.id }).exec();
      if (!sessionDoc) throw new Error('expected a session for the test account');

      const { randomBytes, createHash } = await import('node:crypto');
      const key = randomBytes(32).toString('base64url');
      await getDb().collection('desktop_auth_handoff').insertOne({
        keyHash: createHash('sha256').update(key).digest('hex'),
        sessionId: sessionDoc._id as Types.ObjectId,
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });
      await Session.updateOne(
        { _id: sessionDoc._id },
        { $set: { expiresAt: new Date(Date.now() - 1000) } },
      ).exec();

      const response = await request(app())
        .post('/api/auth/desktop/google/exchange')
        .set(DESKTOP_HEADERS)
        .send({ key });
      expect(response.status).toBe(401);
    });

    it('refuses a handoff whose account was deactivated', async () => {
      const account = await createAccount({
        email: uniqueEmail('dead-handoff'),
        status: 'deactivated',
      });
      const sessionDoc = await Session.findOne({ userId: account.id }).exec();
      if (!sessionDoc) throw new Error('expected a session for the test account');

      const { randomBytes, createHash } = await import('node:crypto');
      const key = randomBytes(32).toString('base64url');
      await getDb().collection('desktop_auth_handoff').insertOne({
        keyHash: createHash('sha256').update(key).digest('hex'),
        sessionId: sessionDoc._id as Types.ObjectId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      const response = await request(app())
        .post('/api/auth/desktop/google/exchange')
        .set(DESKTOP_HEADERS)
        .send({ key });
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/desktop/google/complete', () => {
    it('redirects to the web sign-in when no valid session cookie is present', async () => {
      const response = await request(app())
        .get('/api/auth/desktop/google/complete')
        .set(DESKTOP_HEADERS)
        .send();

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/sign-in?error=google_handoff_failed');
    });
  });
});

describe('the removed desktop sign-in bypass', () => {
  it('no longer mints sessions without credentials', async () => {
    const sessionsBefore = await Session.countDocuments();

    for (const path of ['/api/auth/desktop-signin', '/api/auth/desktop-signin-complete']) {
      const post = await request(app()).post(path).set(DESKTOP_HEADERS).send({
        email: uniqueEmail('ghost'),
      });
      // No route answers: better-auth's handler 404s the unknown path.
      expect(post.status).toBeGreaterThanOrEqual(400);
      expect(post.body.token).toBeUndefined();
      expect(post.body.user).toBeUndefined();

      const get = await request(app()).get(path).set(DESKTOP_HEADERS);
      expect(get.status).toBeGreaterThanOrEqual(400);
    }

    expect(await Session.countDocuments()).toBe(sessionsBefore);
  });

  it('no longer intercepts desktop social sign-in with a pre-selected email', async () => {
    const sessionsBefore = await Session.countDocuments();
    const victim = uniqueEmail('victim');

    const response = await request(app())
      .post('/api/auth/sign-in/social')
      .set(DESKTOP_HEADERS)
      .send({
        provider: 'google',
        email: victim,
        callbackURL: 'http://tauri.localhost/dashboard',
      });

    // The real better-auth handler answers with the genuine Google consent
    // URL (provider is registered with test credentials) — and critically:
    // no session, no token, no user, no desktop-signin-complete URL, and no
    // user created for the supplied email. The interception is gone.
    expect(response.status).toBe(200);
    expect(response.body.url).toMatch(/^https:\/\/(accounts\.google\.com|www\.google\.com)\//);
    expect(response.body.token).toBeUndefined();
    expect(response.body.user).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('desktop-signin-complete');
    expect(await Session.countDocuments()).toBe(sessionsBefore);

    const { User } = await import('../../src/models/user.model.js');
    expect(await User.countDocuments({ email: victim })).toBe(0);
  });
});
