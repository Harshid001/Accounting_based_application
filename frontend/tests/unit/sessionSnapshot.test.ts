import { describe, expect, it, vi } from 'vitest';

import {
  clearSessionSnapshot,
  readSessionSnapshot,
  saveSessionSnapshot,
} from '@/lib/sessionSnapshot';
import * as bridge from '@/lib/desktopBridge';
import { SHELL } from '@/lib/shell';

/**
 * Phase-2 keychain snapshot (spec §5.3): guards only — the snapshot must be
 * a no-op outside the desktop shell and must swallow bridge failures (a
 * locked-down Credential Manager never breaks sign-in).
 */
vi.mock('@/lib/desktopBridge', () => ({
  keychainSet: vi.fn().mockResolvedValue(undefined),
  keychainGet: vi.fn().mockResolvedValue(null),
  keychainDelete: vi.fn().mockResolvedValue(undefined),
}));

describe('session snapshot', () => {
  it('round-trips a snapshot payload through the keychain', async () => {
    if (SHELL !== 'desktop') return; // guard behaviour is shell-gated
    await saveSessionSnapshot('priya@firm.example');
    expect(bridge.keychainSet).toHaveBeenCalledWith(
      'session-snapshot',
      expect.stringContaining('priya@firm.example'),
    );
    await readSessionSnapshot();
    expect(bridge.keychainGet).toHaveBeenCalledWith('session-snapshot');
    await clearSessionSnapshot();
    expect(bridge.keychainDelete).toHaveBeenCalledWith('session-snapshot');
  });

  it('is a no-op in the web shell', async () => {
    if (SHELL === 'desktop') return;
    await saveSessionSnapshot('someone@firm.example');
    await readSessionSnapshot();
    await clearSessionSnapshot();
    expect(bridge.keychainSet).not.toHaveBeenCalled();
    expect(bridge.keychainGet).not.toHaveBeenCalled();
    expect(bridge.keychainDelete).not.toHaveBeenCalled();
  });

  it('returns null for corrupt stored JSON', async () => {
    vi.mocked(bridge.keychainGet).mockResolvedValueOnce('{not json');
    const snapshot = await readSessionSnapshot();
    expect(snapshot).toBeNull();
  });

  it('rejects a payload with wrong field types', async () => {
    vi.mocked(bridge.keychainGet).mockResolvedValueOnce('{"email":5,"savedAt":true}');
    const snapshot = await readSessionSnapshot();
    expect(snapshot).toBeNull();
  });

  it('never throws when the keychain is unavailable', async () => {
    vi.mocked(bridge.keychainSet).mockRejectedValueOnce(new Error('locked'));
    vi.mocked(bridge.keychainGet).mockRejectedValueOnce(new Error('locked'));
    vi.mocked(bridge.keychainDelete).mockRejectedValueOnce(new Error('locked'));
    await expect(saveSessionSnapshot('x@y.test')).resolves.toBeUndefined();
    await expect(readSessionSnapshot()).resolves.toBeNull();
    await expect(clearSessionSnapshot()).resolves.toBeUndefined();
  });
});
