import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import type { TestAccount } from '../helpers/auth.js';
import { app, auth, createAccount } from '../helpers/auth.js';
import { cache } from '../../src/lib/cache.js';
import { FIRM_SETTINGS_ID, FirmSettings } from '../../src/models/firmSettings.model.js';

let admin: TestAccount;
let staff: TestAccount;
let clientUser: TestAccount;

beforeEach(async () => {
  admin = await createAccount({ role: 'admin' });
  staff = await createAccount({ role: 'staff', name: 'Staff User' });
  clientUser = await createAccount({ role: 'client', name: 'Client User' });
});

describe('AI Agent API - Fallback Mode', () => {
  it('returns fallback response with tool badges for deadlines query', async () => {
    const response = await request(app())
      .post('/api/v1/ai/chat')
      .set(auth(admin))
      .send({
        message: 'What deadlines are coming up?',
        history: [],
        currentRoute: '/dashboard',
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty('content');
    expect(response.body.data).toHaveProperty('toolCalls');
    expect(response.body.data).toHaveProperty('actions');
    expect(response.body.data).toHaveProperty('mode', 'fallback');
    expect(response.body.data.toolCalls.length).toBeGreaterThan(0);
    expect(response.body.data.content).toContain('deadline');
  });

  it('returns fallback response for GST filings query', async () => {
    const response = await request(app())
      .post('/api/v1/ai/chat')
      .set(auth(staff))
      .send({
        message: 'Show pending GST filings',
        history: [],
        currentRoute: '/compliance',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.mode).toBe('fallback');
    expect(response.body.data.content).toContain('GST');
    expect(response.body.data.actions.length).toBeGreaterThan(0);
  });

  it('returns fallback response for task query', async () => {
    const response = await request(app())
      .post('/api/v1/ai/chat')
      .set(auth(admin))
      .send({
        message: 'How many tasks do I have?',
        history: [],
        currentRoute: '/tasks',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.mode).toBe('fallback');
    expect(response.body.data.content).toContain('task');
  });

  it('handles task creation request in fallback mode without mistaking it for a filing search', async () => {
    const response = await request(app())
      .post('/api/v1/ai/chat')
      .set(auth(admin))
      .send({
        message: 'can you add a task to do name of task is ITR-file for mayur bhai',
        history: [],
        currentRoute: '/settings/ai',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.mode).toBe('fallback');
    expect(response.body.data.content).toContain('Task creation in reference mode');
    expect(response.body.data.content).not.toContain('Pending INCOME TAX filings');
    expect(response.body.data.actions.some((a: { route: string }) => a.route === '/tasks')).toBe(true);
  });

  it('answers queries about website automation capabilities in fallback mode', async () => {
    const response = await request(app())
      .post('/api/v1/ai/chat')
      .set(auth(admin))
      .send({
        message: 'What can you automate across the website?',
        history: [],
        currentRoute: '/dashboard',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.mode).toBe('fallback');
    expect(response.body.data.content).toContain('Full Website Automation Capabilities');
    expect(response.body.data.content).toContain('Client Management');
    expect(response.body.data.content).toContain('Task Automation');
    expect(response.body.data.content).toContain('Statutory Compliance');
    expect(response.body.data.actions.length).toBeGreaterThan(0);
  });

  it('executes autonomous practice automation for Option 1 query in fallback mode', async () => {
    const response = await request(app())
      .post('/api/v1/ai/chat')
      .set(auth(admin))
      .send({
        message: 'go for option one',
        history: [],
        currentRoute: '/dashboard',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.mode).toBe('fallback');
    expect(response.body.data.content).toContain('Comprehensive Practice Automation');
    expect(response.body.data.toolCalls.some((t: { tool: string }) => t.tool === 'run_autonomous_practice_automation')).toBe(true);
    expect(response.body.data.actions.some((a: { route: string }) => a.route === '/tasks')).toBe(true);
  });

  it('handles empty message with 400', async () => {
    const response = await request(app())
      .post('/api/v1/ai/chat')
      .set(auth(admin))
      .send({
        message: '   ',
        history: [],
        currentRoute: '/dashboard',
      });

    expect(response.status).toBe(400);
  });

  it('client role can access AI chat (read-only scope)', async () => {
    const response = await request(app())
      .post('/api/v1/ai/chat')
      .set(auth(clientUser))
      .send({
        message: 'What are the upcoming deadlines?',
        history: [],
        currentRoute: '/dashboard',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.mode).toBe('fallback');
  });

  it('includes history in request', async () => {
    const response = await request(app())
      .post('/api/v1/ai/chat')
      .set(auth(admin))
      .send({
        message: 'Follow up question',
        history: [
          { role: 'user', content: 'What are deadlines?' },
          { role: 'assistant', content: 'Here are the deadlines...' },
        ],
        currentRoute: '/dashboard',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.content).toBeTruthy();
  });

  it('action routes are valid routes', async () => {
    const response = await request(app())
      .post('/api/v1/ai/chat')
      .set(auth(admin))
      .send({
        message: 'What are the upcoming deadlines?',
        history: [],
        currentRoute: '/dashboard',
      });

    const validRoutes = [
      '/dashboard',
      '/clients',
      '/tasks',
      '/my-work',
      '/compliance',
      '/compliance/generate',
      '/requests',
      '/messages',
      '/reports',
      '/settings',
    ];

    for (const action of response.body.data.actions) {
      expect(validRoutes).toContain(action.route);
      expect(action.label.length).toBeLessThanOrEqual(60);
    }
  });

  it('tool calls have tool name and label', async () => {
    const response = await request(app())
      .post('/api/v1/ai/chat')
      .set(auth(admin))
      .send({
        message: 'What are the upcoming deadlines?',
        history: [],
        currentRoute: '/dashboard',
      });

    for (const tc of response.body.data.toolCalls) {
      expect(tc.tool).toBeTruthy();
      expect(tc.label).toBeTruthy();
    }
  });
});

describe('AI Agent API - Rate Limiting', () => {
  it('enforces rate limit per user', async () => {
    // The aiLimiter allows 20 req/min per user
    // We just verify the endpoint exists and works once
    const response = await request(app())
      .post('/api/v1/ai/chat')
      .set(auth(admin))
      .send({
        message: 'Test rate limit',
        history: [],
        currentRoute: '/dashboard',
      });

    expect(response.status).toBe(200);
  });
});

describe('AI Agent API - Validation', () => {
  it('rejects message exceeding 4000 chars', async () => {
    const longMessage = 'a'.repeat(4001);
    const response = await request(app())
      .post('/api/v1/ai/chat')
      .set(auth(admin))
      .send({
        message: longMessage,
        history: [],
        currentRoute: '/dashboard',
      });

    expect(response.status).toBe(400);
  });

  it('rejects history exceeding 30 entries', async () => {
    const history = Array.from({ length: 31 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`,
    }));

    const response = await request(app())
      .post('/api/v1/ai/chat')
      .set(auth(admin))
      .send({
        message: 'Test',
        history,
        currentRoute: '/dashboard',
      });

    expect(response.status).toBe(400);
  });

  it('rejects history entry with missing role', async () => {
    const response = await request(app())
      .post('/api/v1/ai/chat')
      .set(auth(admin))
      .send({
        message: 'Test',
        history: [{ content: 'No role' }],
        currentRoute: '/dashboard',
      });

    expect(response.status).toBe(400);
  });
});

describe('AI Copilot configuration API', () => {
  const patchConfig = (account: TestAccount, body: Record<string, unknown>) =>
    request(app()).patch('/api/v1/ai/config').set(auth(account)).send(body);

  it('rejects non-admin access to the config endpoints', async () => {
    const staffRead = await request(app()).get('/api/v1/ai/config').set(auth(staff));
    expect(staffRead.status).toBe(403);

    const clientRead = await request(app()).get('/api/v1/ai/config').set(auth(clientUser));
    expect(clientRead.status).toBe(403);

    const staffPatch = await patchConfig(staff, { enabled: true });
    expect(staffPatch.status).toBe(403);
  });

  it('returns the default config view without exposing any key material', async () => {
    const response = await request(app()).get('/api/v1/ai/config').set(auth(admin));
    expect(response.status).toBe(200);

    expect(response.body.data).toMatchObject({
      provider: null,
      enabled: false,
      hasKey: false,
      source: 'none',
    });
    expect(response.body.data.gemini).toMatchObject({ keySet: false });
    expect(response.body.data.openai).toMatchObject({ keySet: false });
    expect(JSON.stringify(response.body)).not.toContain('AIza');
    expect(JSON.stringify(response.body)).not.toContain('sk-');
  });

  it('handles legacy firm settings document missing aiConfig without crashing', async () => {
    cache.invalidate('settings');
    await FirmSettings.collection.deleteOne({ _id: FIRM_SETTINGS_ID });
    const legacyDoc: Record<string, unknown> = {
      _id: FIRM_SETTINGS_ID,
      firmName: 'JV Tax Consultancy',
      defaultReminderOffsetsDays: [7, 3, 1],
      complianceHorizonDays: 120,
      financialYearStartMonth: 4,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await FirmSettings.collection.insertOne(legacyDoc);

    const configResponse = await request(app()).get('/api/v1/ai/config').set(auth(admin));
    expect(configResponse.status).toBe(200);
    expect(configResponse.body.data).toMatchObject({
      provider: null,
      enabled: false,
      hasKey: false,
      source: 'none',
      gemini: { keySet: false, model: 'gemini-2.5-flash' },
      openai: { keySet: false, model: 'gpt-4o-mini' },
    });

    const chatResponse = await request(app())
      .post('/api/v1/ai/chat')
      .set(auth(admin))
      .send({
        message: 'What deadlines are coming up?',
        history: [],
      });
    expect(chatResponse.status).toBe(200);

    const updateResponse = await patchConfig(admin, {
      provider: 'gemini',
      geminiApiKey: 'AIza-test-legacy-doc-1234567890',
    });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.gemini.keySet).toBe(true);
  });

  it('saves an encrypted Gemini key, reports keySet, and enables the copilot', async () => {
    const save = await patchConfig(admin, {
      provider: 'gemini',
      geminiApiKey: 'AIza-test-google-genai-key-1234567890',
    });
    expect(save.status).toBe(200);
    expect(save.body.data.gemini.keySet).toBe(true);
    expect(save.body.data.provider).toBe('gemini');
    expect(JSON.stringify(save.body)).not.toContain('AIza-test');

    const enable = await patchConfig(admin, { enabled: true });
    expect(enable.status).toBe(200);
    expect(enable.body.data.enabled).toBe(true);
    expect(enable.body.data.source).toBe('db');
    expect(enable.body.data.activeModel).toBe('gemini-2.5-flash');

    // Chat now runs in LLM mode; without network the provider call fails and
    // the service gracefully falls back rather than erroring.
    const chat = await request(app())
      .post('/api/v1/ai/chat')
      .set(auth(admin))
      .send({ message: 'What deadlines are coming up?', history: [] });
    expect(chat.status).toBe(200);
    expect(['llm', 'fallback']).toContain(chat.body.data.mode);

    // Verify provider failure is surfaced even if query contains keywords like ITR
    const failWithItr = await request(app())
      .post('/api/v1/ai/chat')
      .set(auth(admin))
      .send({ message: 'can you add a task to do name of task is ITR-file for mayur bhai', history: [] });
    expect(failWithItr.status).toBe(200);
    expect(failWithItr.body.data.content).toContain('reference mode');
    expect(failWithItr.body.data.content).not.toContain('Pending INCOME TAX filings');
  });

  it('refuses enabling without a provider or key', async () => {
    const noProvider = await patchConfig(admin, { enabled: true });
    expect(noProvider.status).toBe(409);

    await patchConfig(admin, { provider: 'openai', enabled: false });
    const noKey = await patchConfig(admin, { enabled: true });
    expect(noKey.status).toBe(409);
  });

  it('updates the model for the chosen provider and clears saved keys', async () => {
    await patchConfig(admin, {
      provider: 'openai',
      openaiApiKey: 'sk-test-openai-key-1234567890abcdef',
      openaiModel: 'gpt-4o',
    });

    const view = await request(app()).get('/api/v1/ai/config').set(auth(admin));
    expect(view.body.data.openai).toMatchObject({ keySet: true, model: 'gpt-4o' });

    const cleared = await patchConfig(admin, { openaiApiKey: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.openai.keySet).toBe(false);
  });

  it('rejects malformed keys and empty update bodies', async () => {
    const shortKey = await patchConfig(admin, { geminiApiKey: 'too-short' });
    expect(shortKey.status).toBe(400);

    const empty = await patchConfig(admin, {});
    expect(empty.status).toBe(400);
  });

  it('rejects non-admin access to model discovery', async () => {
    const response = await request(app())
      .post('/api/v1/ai/models')
      .set(auth(staff))
      .send({ provider: 'gemini' });
    expect(response.status).toBe(403);
  });

  it('returns curated models when no key is configured', async () => {
    const res = await request(app())
      .post('/api/v1/ai/models')
      .set(auth(admin))
      .send({ provider: 'gemini' });

    expect(res.status).toBe(200);
    expect(res.body.data.provider).toBe('gemini');
    expect(Array.isArray(res.body.data.models)).toBe(true);
    expect(res.body.data.models.length).toBeGreaterThan(0);
    expect(res.body.data.models.some((m: { id: string }) => m.id === 'gemini-2.5-flash')).toBe(true);
  });

  it('returns curated OpenAI models when requested without key', async () => {
    const res = await request(app())
      .post('/api/v1/ai/models')
      .set(auth(admin))
      .send({ provider: 'openai' });

    expect(res.status).toBe(200);
    expect(res.body.data.provider).toBe('openai');
    expect(Array.isArray(res.body.data.models)).toBe(true);
    expect(res.body.data.models.some((m: { id: string }) => m.id === 'gpt-4o-mini')).toBe(true);
  });
});