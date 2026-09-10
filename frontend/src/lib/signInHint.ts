/**
 * The remembered sign-in account for the desktop shell (spec §5.3): the
 * keychain snapshot holds it, and the WebView2 profile's localStorage
 * carries the same hint for the sign-in form to pre-fill. Web builds
 * never read or write it — this is a desktop convenience marker only,
 * never a credential.
 */
import { isDesktop } from '@/lib/shell';

const HINT_KEY = 'firmdesk.sign-in-hint';

export const writeSignInHint = (email: string): void => {
  if (!isDesktop) return;
  try {
    window.localStorage.setItem(HINT_KEY, email);
  } catch {
    // Private modes and locked-down profiles: the hint is optional.
  }
};

export const readSignInHint = (): string | null => {
  if (!isDesktop) return null;
  try {
    return window.localStorage.getItem(HINT_KEY);
  } catch {
    return null;
  }
};

export const clearSignInHint = (): void => {
  if (!isDesktop) return;
  try {
    window.localStorage.removeItem(HINT_KEY);
  } catch {
    // Ignore.
  }
};
