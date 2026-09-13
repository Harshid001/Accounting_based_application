import { describe, expect, it, vi } from 'vitest';

/**
 * Provider-independent regression tests for the agent's safety/decision contract.
 * These are intentionally text-level tests: provider calls are mocked elsewhere,
 * while these assertions protect the rules that must never disappear from the prompt.
 */
describe('AI agent decision policy regressions', () => {
  it('requires client resolution before filing', async () => {
    const module = await import('../../src/services/aiAgent.service.js');
    const source = String(module.SYSTEM_PROMPT ?? '');
    expect(source).toContain('Resolve the client');
    expect(source).toContain('ONE clarifying question');
  });

  it('stops when filing inputs are missing', async () => {
    const module = await import('../../src/services/aiAgent.service.js');
    const source = String(module.SYSTEM_PROMPT ?? '');
    expect(source).toContain('missingInputs');
    expect(source).toContain('STOP');
    expect(source).toContain('create_document_request');
  });

  it('never lets the agent provide human-only portal secrets', async () => {
    const module = await import('../../src/services/aiAgent.service.js');
    const source = String(module.SYSTEM_PROMPT ?? '');
    expect(source).toContain('OTP/CAPTCHA/password');
    expect(source).toContain('never supply values');
  });

  it('requires automation coverage before launching a portal run', async () => {
    const module = await import('../../src/services/aiAgent.service.js');
    const source = String(module.SYSTEM_PROMPT ?? '');
    expect(source).toContain('check_automation_support');
    expect(source).toContain('NEVER claim a form is automatable');
  });

  it('recognizes monitoring requests as status operations, not new launches', async () => {
    const module = await import('../../src/services/aiAgent.service.js');
    const source = String(module.SYSTEM_PROMPT ?? '');
    expect(source).toContain('MONITORING INTENTS');
    expect(source).toContain('NEVER re-launch');
    expect(source).toContain('get_automation_run_status');
  });

  it('keeps the agent loop bounded', async () => {
    const module = await import('../../src/services/aiAgent.service.js');
    const source = String(module.MAX_AGENT_ITERATIONS ?? '');
    expect(Number(source)).toBe(12);
  });
});

void vi;
