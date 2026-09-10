/**
 * Phase-2 hardening (spec §5.3): an encrypted session snapshot in the
 * OS keychain (Windows Credential Manager) marks that this workstation had
 * a live session, so boot can optimistically restore instead of flashing
 * the sign-in screen. The cookie itself lives in the WebView2 profile —
 * this snapshot never stores credentials, only a signed-in marker plus
 * which account email (non-sensitive hint) the session belonged to.
 *
 * Written whenever an authenticated session is present (see the watcher
 * in appshell.desktop.tsx) and cleared when it drops — sign-out, revoke,
 * or OS-lock. `readSessionSnapshot` feeds the boot restore: the sign-in
 * email pre-fill and the silent re-auth when the cookie jar still holds
 * the real session.
 */
import { isDesktop } from '@/lib/shell';
import { keychainDelete, keychainGet, keychainSet } from '@/lib/desktopBridge';

const SNAPSHOT_KEY = 'session-snapshot';

export interface SessionSnapshot {
  email: string;
  savedAt: string;
}

export const saveSessionSnapshot = async (email: string): Promise<void> => {
  if (!isDesktop) return;
  const snapshot: SessionSnapshot = { email, savedAt: new Date().toISOString() };
  await keychainSet(SNAPSHOT_KEY, JSON.stringify(snapshot)).catch(() => undefined);
};

export const readSessionSnapshot = async (): Promise<SessionSnapshot | null> => {
  if (!isDesktop) return null;
  const raw = await keychainGet(SNAPSHOT_KEY).catch(() => null);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SessionSnapshot>;
    if (typeof parsed.email !== 'string' || typeof parsed.savedAt !== 'string') return null;
    return { email: parsed.email, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
};

export const clearSessionSnapshot = async (): Promise<void> => {
  if (!isDesktop) return;
  await keychainDelete(SNAPSHOT_KEY).catch(() => undefined);
};
