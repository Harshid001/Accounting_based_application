import { useEffect } from 'react';

import { AppRoutes } from '@/app/router';
import { useSession } from '@/context/SessionContext';
import {
  readSessionSnapshot,
  saveSessionSnapshot,
  clearSessionSnapshot,
} from '@/lib/sessionSnapshot';
import { writeSignInHint, clearSignInHint } from '@/lib/signInHint';

/**
 * Desktop shell: routes + the phase-2 session snapshot. No PWA prompt —
 * the service worker and manifest are disabled in desktop builds
 * (rule: PWA only on web).
 *
 * The keychain snapshot is written whenever an authenticated session is
 * present and cleared when it drops (sign-out, revoke, OS-lock). It never
 * stores the password — just the account email marker so the next boot
 * can restore silently while the cookie jar re-establishes the real
 * session via /me.
 */
function SessionSnapshotWatcher() {
  const { status, user } = useSession();

  useEffect(() => {
    if (status === 'authenticated' && user !== null) {
      void saveSessionSnapshot(user.email);
    }
    if (status === 'anonymous') {
      void clearSessionSnapshot();
    }
  }, [status, user]);

  return null;
}

/**
 * Boot restore (spec §5.3): read the keychain snapshot once at shell
 * mount, before the session query settles, and surface the remembered
 * account so the sign-in screen can pre-fill it. If the WebView2 cookie
 * jar still holds a live session, /me restores the full session and the
 * sign-in screen never appears; otherwise this hint makes the next
 * sign-in one click shorter. Purely an optimistic marker — never a
 * credential.
 */
function SignInHintLoader() {
  useEffect(() => {
    void (async () => {
      const snapshot = await readSessionSnapshot();
      if (snapshot !== null) writeSignInHint(snapshot.email);
      else clearSignInHint();
    })();
  }, []);

  return null;
}

export function AppShell() {
  return (
    <>
      <SignInHintLoader />
      <SessionSnapshotWatcher />
      <AppRoutes />
    </>
  );
}
