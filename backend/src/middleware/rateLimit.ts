import { createHash } from 'node:crypto';

import type { Request, RequestHandler, Response } from 'express';
import { MemoryStore, rateLimit } from 'express-rate-limit';
import type { Options } from 'express-rate-limit';

import { logger } from '../config/logger.js';
import { AppError } from '../lib/errors.js';
import { requestIp } from './requestContext.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const keyByUserOrIp = (req: Request): string =>
  req.authUser ? `u:${req.authUser.id.toString()}` : `ip:${requestIp(req) ?? 'unknown'}`;

const emailFromBody = (req: Request): string | null => req.authEmail ?? null;

const transferTokenKey = (req: Request): string => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  return `tk:${createHash('sha256').update(token).digest('base64url')}`;
};

const handler = (req: Request, _res: Response, next: (error: AppError) => void): void => {
  if (req.path.startsWith('/sign-') || req.path.includes('password')) {
    logger.warn(
      { event: 'auth.rate_limited', ip: requestIp(req), path: req.path },
      'authentication rate limit exceeded',
    );
  }
  next(
    new AppError(
      'RATE_LIMITED',
      'Too many requests from this account or address. Wait a moment and try again.',
    ),
  );
};

const stores: MemoryStore[] = [];

const build = (
  name: string,
  windowMs: number,
  limit: number,
  keyGenerator: (req: Request) => string,
): RequestHandler => {
  const store = new MemoryStore();
  stores.push(store);
  const options: Partial<Options> = {
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req: Request) => `${name}:${keyGenerator(req)}`,
    handler,
    store,
    validate: false,
  };
  return rateLimit(options);
};

export const resetRateLimits = async (): Promise<void> => {
  for (const store of stores) await store.resetAll();
};

const byIp: RequestHandler = build(
  'auth-strict-ip',
  15 * MINUTE,
  5,
  (req) => `ip:${requestIp(req) ?? 'unknown'}`,
);

const byEmail: RequestHandler = build('auth-strict-email', 15 * MINUTE, 5, (req) => {
  const email = emailFromBody(req);
  return email === null ? `ip:${requestIp(req) ?? 'unknown'}` : `em:${email}`;
});

export const authStrictLimiter: RequestHandler = (req, res, next) => {
  byIp(req, res, (ipError?: unknown) => {
    if (ipError !== undefined) {
      next(ipError);
      return;
    }
    byEmail(req, res, next);
  });
};

export const authSessionLimiter: RequestHandler = build(
  'auth-session',
  15 * MINUTE,
  60,
  (req) => `ip:${requestIp(req) ?? 'unknown'}`,
);

export const readLimiter: RequestHandler = build('read', MINUTE, 600, keyByUserOrIp);
export const mutationLimiter: RequestHandler = build('mutation', MINUTE, 120, keyByUserOrIp);
export const uploadLimiter: RequestHandler = build('upload', HOUR, 60, keyByUserOrIp);
export const downloadTransferLimiter: RequestHandler = build(
  'download-transfer',
  MINUTE,
  3,
  transferTokenKey,
);
export const exportLimiter: RequestHandler = build('export', HOUR, 10, keyByUserOrIp);
export const searchLimiter: RequestHandler = build('search', MINUTE, 120, keyByUserOrIp);
export const bulkLimiter: RequestHandler = build('bulk', HOUR, 10, keyByUserOrIp);
export const revealLimiter: RequestHandler = build('reveal', HOUR, 10, keyByUserOrIp);
export const publicReportLimiter: RequestHandler = build(
  'public-report',
  HOUR,
  30,
  (req) => `ip:${requestIp(req) ?? 'unknown'}`,
);

export const logAuthLimitHit = (req: Request): void => {
  logger.warn(
    { event: 'auth.rate_limited', ip: requestIp(req), path: req.path },
    'authentication rate limit exceeded',
  );
};
