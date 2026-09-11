import crypto from 'node:crypto';
import express, { Router } from 'express';
import type {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import type { Types } from 'mongoose';
import { makeSignature } from 'better-auth/crypto';

import { getAuth } from '../config/auth.js';
import { env, googleOAuthConfigured, isProduction } from '../config/env.js';
import { getDb } from '../config/db.js';
import { AppError, forbidden, unauthenticated } from '../lib/errors.js';
import { authSessionLimiter, authStrictLimiter } from '../middleware/rateLimit.js';
import { Session } from '../models/session.model.js';
import { User } from '../models/user.model.js';

const STRICT_PATHS = [
  '/sign-up/email',
  '/sign-in/email',
  '/forget-password',
  '/request-password-reset',
  '/reset-password',
  '/send-verification-email',
];

const SESSION_PATHS = ['/get-session', '/sign-out', '/list-sessions'];

const pathOf = (req: ExpressRequest): string => (req.path === '' ? '/' : req.path);

const readEmailFromRawBody = (
  req: ExpressRequest,
  _res: ExpressResponse,
  next: NextFunction,
): void => {
  const raw: unknown = req.body;
  if (!Buffer.isBuffer(raw) || raw.length === 0) {
    next();
    return;
  }
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.includes('application/json')) {
    next();
    return;
  }
  try {
    const parsed: unknown = JSON.parse(raw.toString('utf8'));
    if (parsed !== null && typeof parsed === 'object') {
      const value = (parsed as Record<string, unknown>).email;
      if (typeof value === 'string') {
        req.authEmail = value.trim().toLowerCase().slice(0, 200);
      }
    }
  } catch {
    next();
    return;
  }
  next();
};

const chooseLimiter = (req: ExpressRequest, res: ExpressResponse, next: NextFunction): void => {
  const path = pathOf(req);
  if (STRICT_PATHS.some((candidate) => path.startsWith(candidate))) {
    authStrictLimiter(req, res, next);
    return;
  }
  if (SESSION_PATHS.some((candidate) => path.startsWith(candidate))) {
    authSessionLimiter(req, res, next);
    return;
  }
  next();
};

const forwardToBetterAuth = (
  req: ExpressRequest,
  res: ExpressResponse,
  next: NextFunction,
): void => {
  void (async () => {
    try {
      const base = env.BETTER_AUTH_URL.replace(/\/+$/, '');
      const url = new URL(`${base}${req.originalUrl}`);
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const entry of value) headers.append(key, String(entry));
        } else {
          headers.set(key, String(value));
        }
      }

      const raw: unknown = req.body;
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
      const body = hasBody && Buffer.isBuffer(raw) && raw.length > 0 ? raw : undefined;

      const response = await getAuth().handler(
        new globalThis.Request(url, { method: req.method, headers, body }),
      );

      res.status(response.status);
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'set-cookie') {
          res.append('set-cookie', value);
        } else {
          res.setHeader(key, value);
        }
      });
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      next(error);
    }
  })();
};

// ---------------------------------------------------------------------------
// Desktop Google sign-in handoff (real OAuth: system browser + deep link)
//
// The desktop shell never receives a session without Google actually
// validating the account. Flow:
//
//   1. Desktop webview  POST /desktop/google/start
//      → better-auth signInSocial { provider: 'google', disableRedirect: true,
//        callbackURL: <BETTER_AUTH_URL>/api/auth/desktop/google/complete }
//      → OAuth state lands in the `verification` collection (the MongoDB
//        adapter makes the state store stateful, so the callback works even
//        though it arrives from the system browser, a different client than
//        the one that started the flow). Returns { url } — the consent page.
//   2. Shell opens the URL via the Tauri opener plugin (system browser).
//   3. Google  GET /callback/google  (standard better-auth: code + state
//      validated, session created, cookie set on the system browser) →
//      redirects to the callbackURL from the state.
//   4. GET /desktop/google/complete — served to the system browser. Mints a
//      one-time handoff key bound to the just-created session, then sends
//      the browser to firmdesk://auth-complete (deep link into the app).
//      Only the random key crosses the browser→app boundary — never the
//      session token.
//   5. Deep link wakes the app; the webview POST /desktop/google/exchange
//      { key }. The key is consumed exactly once (atomic findOneAndDelete);
//      the referenced session is re-checked (not expired, user active and
//      verified); only then are the httpOnly cookie and the Bearer token
//      issued to the desktop webview origin.
// ---------------------------------------------------------------------------

const DESKTOP_SHELL_HEADER = 'x-firmdesk-shell';
const HANDOFF_TTL_MS = 5 * 60 * 1000;
const HANDOFF_COLLECTION = 'desktop_auth_handoff';
const DEEP_LINK_SCHEME = 'firmdesk://auth-complete';

const isDesktopShellRequest = (req: ExpressRequest): boolean => {
  const origin = req.headers.origin ?? '';
  const referer = req.headers.referer ?? '';
  return (
    req.headers[DESKTOP_SHELL_HEADER] === 'desktop' ||
    origin.includes('tauri.localhost') ||
    referer.includes('tauri.localhost')
  );
};

const sha256 = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

interface HandoffDocument {
  keyHash: string;
  sessionId: Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * One-time handoff key: 256 bits of entropy, only ever stored as SHA-256.
 * The plaintext exists solely in the deep link and the exchange request.
 */
const storeHandoff = async (sessionId: Types.ObjectId): Promise<string> => {
  const key = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  await getDb()
    .collection<HandoffDocument>(HANDOFF_COLLECTION)
    .insertOne({
      keyHash: sha256(key),
      sessionId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + HANDOFF_TTL_MS),
    });
  return key;
};

const consumeHandoff = async (
  key: string,
): Promise<{ sessionId: Types.ObjectId } | null> => {
  const record = await getDb()
    .collection<HandoffDocument>(HANDOFF_COLLECTION)
    .findOneAndDelete({
      keyHash: sha256(key),
      expiresAt: { $gt: new Date() },
    });
  if (record === null) return null;
  return { sessionId: record.sessionId };
};

const htmlEscape = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * POST /api/auth/desktop/google/start — desktop-only. Returns the Google
 * consent URL as JSON; the shell must open it in the system browser.
 */
const desktopGoogleStart = async (
  req: ExpressRequest,
  res: ExpressResponse,
): Promise<void> => {
  if (!googleOAuthConfigured) {
    throw new AppError(
      'INTERNAL',
      'Google sign-in is not configured on this FirmDesk deployment.',
    );
  }
  if (!isDesktopShellRequest(req)) {
    throw forbidden('This entry point is only available in the FirmDesk desktop app.');
  }

  const result = await getAuth().api.signInSocial({
    body: {
      provider: 'google',
      callbackURL: `${env.BETTER_AUTH_URL.replace(/\/+$/, '')}/api/auth/desktop/google/complete`,
      errorCallbackURL: `${env.APP_BASE_URL}/sign-in`,
      disableRedirect: true,
    },
  });

  const url = typeof result?.url === 'string' ? result.url : null;
  if (url === null || !url.startsWith('https://')) {
    throw new AppError('INTERNAL', 'Could not start Google sign-in. Please try again.');
  }
  res.status(200).json({ url });
};

/**
 * GET /api/auth/desktop/google/complete — the system browser lands here after
 * /callback/google created the session. Mints the one-time key and forwards
 * the browser into the app via the firmdesk:// deep link. The HTML fallback
 * covers browsers that ask before opening an external app.
 */
const desktopGoogleComplete = async (
  req: ExpressRequest,
  res: ExpressResponse,
): Promise<void> => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
  }
  const session = await getAuth().api.getSession({ headers });

  const token = session?.session?.token;
  const userId = session?.user?.id;
  if (typeof token !== 'string' || typeof userId !== 'string') {
    res.redirect(
      `${env.APP_BASE_URL}/sign-in?error=${encodeURIComponent('google_handoff_failed')}`,
    );
    return;
  }

  const stored = await Session.findOne({ token }).select('_id').lean().exec();
  if (stored === null) {
    res.redirect(
      `${env.APP_BASE_URL}/sign-in?error=${encodeURIComponent('google_handoff_failed')}`,
    );
    return;
  }

  const key = await storeHandoff(stored._id);
  const deepLink = `${DEEP_LINK_SCHEME}?key=${encodeURIComponent(key)}`;
  const safeLink = htmlEscape(deepLink);

  res.status(200).type('html').send(
    `<!doctype html><html><head><meta charset="utf-8">` +
      `<title>Returning to FirmDesk…</title>` +
      `<meta http-equiv="refresh" content="0;url=${safeLink}"></head>` +
      `<body style="font-family:system-ui;background:#0b0f14;color:#e6e9ee;display:flex;` +
      `align-items:center;justify-content:center;height:100vh;margin:0">` +
      `<div style="text-align:center">` +
      `<h1 style="font-size:18px;font-weight:600">Sign-in complete</h1>` +
      `<p style="font-size:14px;color:#9aa4b2">You can close this tab and return to the FirmDesk app.</p>` +
      `<a href="${safeLink}" style="font-size:14px;color:#7aa2f7">Open FirmDesk</a>` +
      `</div><script>location.replace(${JSON.stringify(deepLink)})</script></body></html>`,
  );
};

/**
 * POST /api/auth/desktop/google/exchange { key } — desktop-webview side of the
 * handoff. The webview holds no cookies from the system browser, so it
 * presents the one-time key; the server resolves the session that Google's
 * validated exchange created, re-checks it end to end, and only then issues
 * the session cookie (+ Bearer token for the WebView2 fetch wrapper) to the
 * desktop origin.
 */
const desktopGoogleExchange = async (
  req: ExpressRequest,
  res: ExpressResponse,
): Promise<void> => {
  if (!isDesktopShellRequest(req)) {
    throw forbidden('This entry point is only available in the FirmDesk desktop app.');
  }
  const body = req.body as { key?: unknown } | undefined;
  const key = typeof body?.key === 'string' ? body.key : '';
  if (key.length < 32 || key.length > 256) {
    throw unauthenticated('That Google sign-in handoff is no longer valid. Please try again.');
  }

  const handoff = await consumeHandoff(key);
  if (handoff === null) {
    throw unauthenticated('That Google sign-in handoff is no longer valid. Please try again.');
  }

  const sessionDoc = await Session.findById(handoff.sessionId).exec();
  if (sessionDoc === null || sessionDoc.expiresAt.getTime() <= Date.now()) {
    throw unauthenticated('That session has expired. Please sign in again.');
  }

  const user = await User.findById(sessionDoc.userId).exec();
  if (user === null || user.status !== 'active' || !user.emailVerified) {
    throw unauthenticated('This account cannot be used. Contact your firm administrator.');
  }

  const maxAge = Math.max(0, sessionDoc.expiresAt.getTime() - Date.now());
  // better-auth cookie values are signed (`token.signature`); the DB stores
  // only the raw token. Sign before issuing so the cookie and the Bearer
  // fallback both match what /get-session expects.
  const signedToken = `${sessionDoc.token}.${await makeSignature(
    sessionDoc.token,
    env.BETTER_AUTH_SECRET,
  )}`;
  res.cookie('better-auth.session_token', signedToken, {
    httpOnly: true,
    path: '/',
    maxAge,
    sameSite: env.SESSION_COOKIE_SAMESITE,
    secure: isProduction,
  });

  res.status(200).json({
    token: signedToken,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
};

export const betterAuthRouter: Router = Router();

// Desktop handoff routes — mounted before the raw-body forwarder so their own
// JSON parsing applies. start/exchange sit behind the strict limiter because
// they are unauthenticated entry points; complete is a redirect landing page
// behind the session limiter.
betterAuthRouter.post(
  '/desktop/google/start',
  express.json({ limit: '8kb' }),
  authStrictLimiter,
  (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    void desktopGoogleStart(req, res).catch(next);
  },
);

betterAuthRouter.get(
  '/desktop/google/complete',
  authSessionLimiter,
  (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    void desktopGoogleComplete(req, res).catch(next);
  },
);

betterAuthRouter.post(
  '/desktop/google/exchange',
  express.json({ limit: '8kb' }),
  authStrictLimiter,
  (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    void desktopGoogleExchange(req, res).catch(next);
  },
);

betterAuthRouter.use(express.raw({ type: '*/*', limit: '256kb' }));
betterAuthRouter.use(readEmailFromRawBody);
betterAuthRouter.use(chooseLimiter);
betterAuthRouter.use(forwardToBetterAuth);
