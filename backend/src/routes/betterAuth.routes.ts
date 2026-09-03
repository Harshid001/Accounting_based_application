import express, { Router } from 'express';
import type { NextFunction, Request as ExpressRequest, Response as ExpressResponse } from 'express';

import { getAuth } from '../config/auth.js';
import { env } from '../config/env.js';
import { authSessionLimiter, authStrictLimiter } from '../middleware/rateLimit.js';

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

const readEmailFromRawBody = (req: ExpressRequest, _res: ExpressResponse, next: NextFunction): void => {
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

const forwardToBetterAuth = (req: ExpressRequest, res: ExpressResponse, next: NextFunction): void => {
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

betterAuthRouter.use(express.raw({ type: '*/*', limit: '256kb' }));
betterAuthRouter.use(readEmailFromRawBody);
betterAuthRouter.use(chooseLimiter);
betterAuthRouter.use(forwardToBetterAuth);
