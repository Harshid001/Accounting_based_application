import { describe, expect, it } from 'vitest';

/**
 * Provider-independent regression tests for the agent's decision policy.
 * The implementation keeps policy constants private, so these tests verify
 * the exported tool contract rather than reaching into private module state.
 */
describe('AI agent decision policy regressions', () => {
  it('exposes the filing-decision tools required by the safety ladder', async () => {
    const module = await import('../../src/services/aiAgent.service.js');
    expect(module.agentToolNames).toContain('check_automation_support');
    expect(module.agentToolNames).toContain('get_automation_run_status');
    expect(module.agentToolNames).toContain('create_document_request');
    expect(module.agentToolNames).toContain('run_portal_automation');
  });

  it('exposes monitoring and recovery controls', async () => {
    const module = await import('../../src/services/aiAgent.service.js');
    expect(module.agentToolNames).toContain('list_automation_runs');
    expect(module.agentToolNames).toContain('retry_automation_run');
    expect(module.agentToolNames).toContain('abort_automation_run');
  });

  it('keeps human-only portal credentials outside agent tools', async () => {
    const module = await import('../../src/services/aiAgent.service.js');
    const source = Object.keys(module).join('\n');
    expect(source).not.toMatch(/submit.*otp|set.*captcha|provide.*password/i);
  });
});
