import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { env } from '../../src/config/env.js';
import { app, auth, createAccount } from '../helpers/auth.js';
import { makeBusinessClient } from '../helpers/factories.js';

/**
 * Desktop shell version manifest (spec §5.4 / §9.2): public endpoint, read
 * before sign-in, minShellVersion enforced as the update-gate source.
 */

const api = () => request(app());

describe('desktop manifest', () => {
  it('is public: no session required', async () => {
    const response = await api().get('/api/v1/desktop/manifest');
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      minShellVersion: env.DESKTOP_MIN_SHELL_VERSION,
      latestShellVersion: env.DESKTOP_LATEST_SHELL_VERSION,
      updateUrl: env.DESKTOP_UPDATE_URL,
    });
  });

  it('advertises semver strings and an https update url', async () => {
    const response = await api().get('/api/v1/desktop/manifest');
    const { minShellVersion, latestShellVersion, updateUrl } = response.body.data as Record<
      string,
      string
    >;
    expect(minShellVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(latestShellVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(updateUrl).toMatch(/^https:\/\//);
  });
});

describe('desktop command queue isolation', () => {
  it('refuses clients the desktop:workstation capability (403)', async () => {
    const client = await createAccount({ role: 'client', linkedClients: [] });
    const register = await api()
      .post('/api/v1/desktop/workstation/register')
      .set(auth(client))
      .send({ deviceId: 'WS-CLIENT-0001', deviceName: 'Client PC' });
    expect(register.status).toBe(403);
  });

  it('refuses clients the staff tally bridge even with a valid client scope', async () => {
    const clientId = await makeBusinessClient({
      booksMode: 'hybrid',
      tallyConfig: { companyName: 'Sharma Traders', edition: 'erp9' },
    });
    const client = await createAccount({ role: 'client', linkedClients: [clientId] });
    const status = await api()
      .get('/api/v1/books/tally/status')
      .query({ client: clientId.toString() })
      .set(auth(client));
    expect(status.status).toBe(403);
  });
});

describe('shell version gate (rule 7)', () => {
  it('refuses registration from a below-min desktop version (426)', async () => {
    const admin = await createAccount({ role: 'admin' });
    const register = await api()
      .post('/api/v1/desktop/workstation/register')
      .set(auth(admin))
      .send({ deviceId: 'WS-OLD-0001', deviceName: 'Old PC', appVersion: '0.0.1' });
    expect(register.status).toBe(426);
    expect(register.body.error.code).toBe('UPGRADE_REQUIRED');
    expect(register.body.error.message).toContain('too old');
  });

  it('accepts registration at the minimum version', async () => {
    const admin = await createAccount({ role: 'admin' });
    const register = await api()
      .post('/api/v1/desktop/workstation/register')
      .set(auth(admin))
      .send({
        deviceId: 'WS-NEW-0001',
        deviceName: 'New PC',
        appVersion: env.DESKTOP_MIN_SHELL_VERSION,
      });
    expect(register.status).toBe(201);
  });

  it('refuses the heartbeat too: an outdated shell cannot stay online (426)', async () => {
    const admin = await createAccount({ role: 'admin' });
    await api()
      .post('/api/v1/desktop/workstation/register')
      .set(auth(admin))
      .send({ deviceId: 'WS-STALE-001', deviceName: 'Stale PC', appVersion: '0.0.1' })
      .expect(426);

    // A stale shell that somehow holds a workstation record (registered in a
    // previous, allowed era) is still cut off at the next beat.
    const { Workstation } = await import('../../src/models/workstation.model.js');
    await Workstation.create({
      user: admin.id,
      deviceId: 'WS-STALE-001',
      deviceName: 'Stale PC',
      appVersion: '0.0.1',
      lastSeenAt: new Date(),
    });
    const ping = await api()
      .post('/api/v1/desktop/workstation/ping')
      .set(auth(admin))
      .send({ deviceId: 'WS-STALE-001', appVersion: '0.0.1' });
    expect(ping.status).toBe(426);
    expect(ping.body.error.code).toBe('UPGRADE_REQUIRED');
  });

  it('lets a current shell heartbeat and refreshes its recorded version', async () => {
    const admin = await createAccount({ role: 'admin' });
    await api()
      .post('/api/v1/desktop/workstation/register')
      .set(auth(admin))
      .send({ deviceId: 'WS-CUR-0001', deviceName: 'Current PC' })
      .expect(201);
    const ping = await api()
      .post('/api/v1/desktop/workstation/ping')
      .set(auth(admin))
      .send({ deviceId: 'WS-CUR-0001', appVersion: env.DESKTOP_MIN_SHELL_VERSION });
    expect(ping.status).toBe(200);
    expect(ping.body.data).toMatchObject({ online: true });
  });
});
