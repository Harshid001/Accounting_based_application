import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { Session } from '../../src/models/session.model.js';
import { app, createAccount, STRONG_PASSWORD } from '../helpers/auth.js';

const DESKTOP_HEADERS = {
  'Content-Type': 'application/json',
  Origin: 'http://tauri.localhost',
  'X-FirmDesk-Shell': 'desktop',
};

describe('desktop bearer authentication', () => {
  it('allows staff to sign in and access /api/v1/me via Authorization Bearer token without cookies', async () => {
    const staff = await createAccount({ role: 'staff' });

    // Step 1: Sign in with email from desktop origin
    const signInResponse = await request(app())
      .post('/api/auth/sign-in/email')
      .set(DESKTOP_HEADERS)
      .send({
        email: staff.email,
        password: STRONG_PASSWORD,
      });

    expect(signInResponse.status).toBe(200);
    const token = signInResponse.body.token || signInResponse.body.session?.token;
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);

    // Verify session exists in DB
    const rawToken = token.includes('.') ? token.split('.')[0] : token;
    const sessionDoc = await Session.findOne({ token: rawToken });
    expect(sessionDoc).not.toBeNull();
    expect(sessionDoc?.userId.toString()).toBe(staff.id.toString());

    // Step 2: Access /api/v1/me using ONLY Authorization: Bearer <token> (no cookie header)
    const meResponse = await request(app())
      .get('/api/v1/me')
      .set({
        Authorization: `Bearer ${token}`,
        Origin: 'http://tauri.localhost',
      });

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.email).toBe(staff.email);
    expect(meResponse.body.data.role).toBe('staff');
  });

  it('allows admin to sign in and access /api/v1/me via Authorization Bearer token without cookies', async () => {
    const admin = await createAccount({ role: 'admin' });

    const signInResponse = await request(app())
      .post('/api/auth/sign-in/email')
      .set(DESKTOP_HEADERS)
      .send({
        email: admin.email,
        password: STRONG_PASSWORD,
      });

    expect(signInResponse.status).toBe(200);
    const token = signInResponse.body.token || signInResponse.body.session?.token;
    expect(typeof token).toBe('string');

    // Access /api/v1/me with Bearer token
    const meResponse = await request(app())
      .get('/api/v1/me')
      .set({
        Authorization: `Bearer ${token}`,
        Origin: 'http://tauri.localhost',
      });

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.email).toBe(admin.email);
    expect(meResponse.body.data.role).toBe('admin');
  });

  it('rejects expired or invalid bearer tokens', async () => {
    const fakeTokenResponse = await request(app())
      .get('/api/v1/me')
      .set({
        Authorization: 'Bearer invalid-token-1234567890',
        Origin: 'http://tauri.localhost',
      });

    expect(fakeTokenResponse.status).toBe(401);
    expect(fakeTokenResponse.body.error.code).toBe('UNAUTHENTICATED');
  });
});
