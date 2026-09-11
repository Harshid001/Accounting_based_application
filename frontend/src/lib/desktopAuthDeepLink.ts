/**
 * Deep-link parsing for the desktop Google sign-in handoff.
 *
 * The backend's /desktop/google/complete page sends the system browser to
 * firmdesk://auth-complete?key=<one-time-key>. This module owns the strict
 * validation of that URL — the key is the only thing that ever crosses the
 * browser→app boundary, and it is consumed exactly once by the exchange
 * endpoint. Everything else in the URL (other params, fragments, hosts) is
 * rejected so a malicious link cannot smuggle data into the app.
 */

export const AUTH_COMPLETE_PATH = 'auth-complete';

/** Minimum/maximum plausible key length (base64url of 32 random bytes). */
const KEY_MIN_LENGTH = 32;
const KEY_MAX_LENGTH = 256;

/** base64url alphabet (A-Z a-z 0-9 - _). No padding characters. */
const BASE64URL = /^[A-Za-z0-9_-]+$/;

export interface AuthDeepLink {
  key: string;
}

// ---------------------------------------------------------------------------
// Pending-key parking (module-scoped, shell-neutral)
//
// When the app cold-starts from a firmdesk://auth-complete link (or the link
// arrives while the sign-in screen is unmounted), the desktop shell parks the
// one-time key here. The sign-in screen consumes it when it mounts. Kept in
// this lib module — not the desktop appshell — because the shared auth routes
// must not import desktop-shell-only code into the web bundle.
// ---------------------------------------------------------------------------

let pendingAuthKey: string | null = null;

/** Parse and park a deep-link URL if it is a valid auth-complete link. */
export const parkPendingAuthKey = (url: string): void => {
  const link = parseAuthDeepLink(url);
  if (link === null) return;
  pendingAuthKey ??= link.key;
};

/** Take the parked key (if any). One-shot: the first consumer wins. */
export const consumePendingAuthDeepLink = (): string | null => {
  const key = pendingAuthKey;
  pendingAuthKey = null;
  return key;
};

/**
 * Validate a firmdesk:// deep link and extract the handoff key.
 * Returns null for anything that is not exactly
 * `firmdesk://auth-complete?key=<base64url>`.
 */
export const parseAuthDeepLink = (url: string): AuthDeepLink | null => {
  if (typeof url !== 'string' || url.length === 0 || url.length > 512) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // Scheme must be exactly firmdesk (URL normalizes to lowercase). A link
  // like javascript://auth-complete?key=... must never reach the handler.
  if (parsed.protocol !== 'firmdesk:') return null;

  // Windows delivers custom-scheme links with a synthetic host: the plugin
  // normalizes `firmdesk://auth-complete` to host `auth-complete`, empty path.
  // macOS/Linux deliver `firmdesk:///auth-complete` (empty host, path).
  // Accept exactly those two shapes and nothing else.
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.replace(/^\/+|\/+$/g, '');
  const matchesShape = (host === AUTH_COMPLETE_PATH && path === '') || (host === '' && path === AUTH_COMPLETE_PATH);
  if (!matchesShape) return null;

  const params = new URLSearchParams(parsed.search);
  if (params.size !== 1) return null;

  const key = params.get('key');
  if (key === null) return null;
  if (key.length < KEY_MIN_LENGTH || key.length > KEY_MAX_LENGTH) return null;
  if (!BASE64URL.test(key)) return null;

  return { key };
};
