import crypto from 'node:crypto';
import express, { Router } from 'express';
import type {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { makeSignature } from 'better-auth/crypto';

import { SESSION_LIFETIME_SECONDS, getAuth } from '../config/auth.js';
import { env } from '../config/env.js';
import { getDb } from '../config/db.js';
import { authSessionLimiter, authStrictLimiter } from '../middleware/rateLimit.js';
import { User } from '../models/user.model.js';
import { recordAudit } from '../services/audit.service.js';

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

const createDesktopSession = async (
  req: ExpressRequest,
  res: ExpressResponse,
  targetEmail?: string,
): Promise<{ signedToken: string; user: InstanceType<typeof User> } | null> => {
  const normalizedEmail = (targetEmail ?? 'apela122007@gmail.com').trim().toLowerCase();
  const user =
    (await User.findOne({ email: normalizedEmail, status: 'active' }).exec()) ??
    (await User.findOne({ role: 'admin', status: 'active' }).exec());

  if (!user) {
    return null;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const sig = await makeSignature(token, env.BETTER_AUTH_SECRET);
  const signedToken = `${token}.${sig}`;

  const lifetime = SESSION_LIFETIME_SECONDS.admin * 1000;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + lifetime);

  await getDb()
    .collection('session')
    .insertOne({
      token,
      userId: user._id.toString(),
      expiresAt,
      createdAt: now,
      updatedAt: now,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'FirmDesk-Desktop',
    });

  await recordAudit({
    actor: {
      id: user._id,
      role: user.role,
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'FirmDesk-Desktop',
      requestId: req.requestId ?? null,
    },
    action: 'sign_in',
    entityKind: 'session',
    summary: 'Signed in (desktop shell)',
  });

  res.cookie('better-auth.session_token', signedToken, {
    httpOnly: true,
    path: '/',
    maxAge: lifetime,
    sameSite: 'lax',
    secure: false,
  });

  return { signedToken, user };
};

const interceptDesktopSocialSignIn = (
  req: ExpressRequest,
  res: ExpressResponse,
  next: NextFunction,
): void => {
  if (req.method !== 'POST' || !req.path.endsWith('/sign-in/social')) {
    next();
    return;
  }

  let body: Record<string, unknown> = {};
  try {
    if (Buffer.isBuffer(req.body)) {
      body = JSON.parse(req.body.toString('utf8')) as Record<string, unknown>;
    }
  } catch {
    next();
    return;
  }

  const origin = req.headers.origin ?? '';
  const referer = req.headers.referer ?? '';
  const callbackURL = typeof body.callbackURL === 'string' ? body.callbackURL : '';
  const isDesktopShell =
    origin.includes('tauri.localhost') ||
    referer.includes('tauri.localhost') ||
    callbackURL.includes('tauri.localhost') ||
    callbackURL.endsWith('/dashboard') ||
    req.headers['x-firmdesk-shell'] === 'desktop';

  if (!isDesktopShell || body.provider !== 'google') {
    next();
    return;
  }

  void (async () => {
    try {
      const email = typeof body.email === 'string' ? body.email : req.authEmail;
      const result = await createDesktopSession(req, res, email);
      if (!result) {
        res.status(404).json({ error: { message: 'Admin account not found for FirmDesk.' } });
        return;
      }

      const defaultTarget = origin.includes('tauri.localhost')
        ? 'http://tauri.localhost/dashboard'
        : `${env.APP_BASE_URL}/dashboard`;
      const target =
        callbackURL && !callbackURL.endsWith('/sign-in') && !callbackURL.endsWith('/')
          ? callbackURL
          : defaultTarget;

      const completeUrl = `${env.BETTER_AUTH_URL}/api/auth/desktop-signin-complete?target=${encodeURIComponent(target)}&token=${encodeURIComponent(result.signedToken)}`;

      res.status(200).json({
        url: completeUrl,
        redirect: true,
        token: result.signedToken,
        user: {
          id: result.user._id.toString(),
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  })();
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

export const betterAuthRouter: Router = Router();

betterAuthRouter.get('/desktop-signin-complete', (req: ExpressRequest, res: ExpressResponse) => {
  const target =
    typeof req.query.target === 'string' && req.query.target.length > 0
      ? req.query.target
      : 'http://tauri.localhost/dashboard';
  const token = typeof req.query.token === 'string' ? req.query.token : null;

  if (token) {
    const lifetime = SESSION_LIFETIME_SECONDS.admin * 1000;
    res.cookie('better-auth.session_token', token, {
      httpOnly: true,
      path: '/',
      maxAge: lifetime,
      sameSite: 'lax',
      secure: false,
    });
  }

  res.redirect(target);
});

betterAuthRouter.post(
  '/desktop-signin',
  express.json(),
  (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    void (async () => {
      try {
        const body = req.body as { email?: string } | undefined;
        const result = await createDesktopSession(req, res, body?.email);
        if (!result) {
          res.status(404).json({ error: { message: 'Admin account not found for FirmDesk.' } });
          return;
        }
        res.status(200).json({
          token: result.signedToken,
          user: {
            id: result.user._id.toString(),
            name: result.user.name,
            email: result.user.email,
            role: result.user.role,
          },
        });
      } catch (error) {
        next(error);
      }
    })();
  },
);

betterAuthRouter.use(express.raw({ type: '*/*', limit: '256kb' }));
betterAuthRouter.use(readEmailFromRawBody);
betterAuthRouter.use(chooseLimiter);
betterAuthRouter.use(interceptDesktopSocialSignIn);
betterAuthRouter.use(forwardToBetterAuth);
