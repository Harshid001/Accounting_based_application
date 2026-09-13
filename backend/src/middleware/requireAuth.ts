import { makeSignature } from 'better-auth/crypto';
import { fromNodeHeaders } from 'better-auth/node';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Types } from 'mongoose';

import {
  SESSION_HARD_CAP_SECONDS,
  SESSION_LIFETIME_SECONDS,
  SESSION_REFRESH_AFTER_SECONDS,
  getAuth,
} from '../config/auth.js';
import { env } from '../config/env.js';
import { emailUnverified, unauthenticated } from '../lib/errors.js';
import { Session } from '../models/session.model.js';
import { User } from '../models/user.model.js';
import type { UserDocument } from '../models/user.model.js';
import { actorFromUser } from '../types/context.js';
import type { AuthenticatedUser } from '../types/context.js';
import { requestIp, requestUserAgent } from './requestContext.js';

const LAST_SEEN_INTERVAL_MS = 60 * 60 * 1000;

const toAuthenticatedUser = (doc: UserDocument): AuthenticatedUser => ({
  id: doc._id,
  name: doc.name,
  email: doc.email,
  emailVerified: doc.emailVerified,
  role: doc.role,
  status: doc.status,
  linkedClients: doc.linkedClients,
  pinnedClients: doc.pinnedClients,
  notificationPreferences: doc.notificationPreferences,
});

const slideSession = async (
  sessionId: Types.ObjectId,
  role: AuthenticatedUser['role'],
): Promise<void> => {
  const lifetimeMs = SESSION_LIFETIME_SECONDS[role] * 1000;
  const now = Date.now();
  const session = await Session.findById(sessionId).exec();
  if (!session) return;
  const remaining = session.expiresAt.getTime() - now;
  if (remaining > lifetimeMs - SESSION_REFRESH_AFTER_SECONDS * 1000) return;
  const hardCap = session.createdAt.getTime() + SESSION_HARD_CAP_SECONDS * 1000;
  const extended = Math.min(now + lifetimeMs, hardCap);
  if (extended <= session.expiresAt.getTime()) return;
  session.expiresAt = new Date(extended);
  await session.save();
};

export const resolveSession: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  void (async () => {
    try {
      const headers = { ...req.headers };
      let bearerToken: string | null = null;
      if (
        typeof headers.authorization === 'string' &&
        headers.authorization.startsWith('Bearer ')
      ) {
        bearerToken = headers.authorization.slice(7).trim();
      }

      if (bearerToken && bearerToken.length > 0) {
        const rawToken = bearerToken.includes('.') ? (bearerToken.split('.')[0] ?? bearerToken) : bearerToken;
        try {
          const sig = bearerToken.includes('.')
            ? (bearerToken.split('.')[1] ?? '')
            : await makeSignature(rawToken, env.BETTER_AUTH_SECRET);
          if (sig.length > 0) {
            const signed = `${rawToken}.${sig}`;
            const existing =
              typeof headers.cookie === 'string' && headers.cookie.length > 0
                ? `${headers.cookie}; `
                : '';
            headers.cookie = `${existing}__Secure-better-auth.session_token=${signed}; better-auth.session_token=${signed}`;
          }
        } catch {
          // Signing error, fallback will handle DB resolution
        }
      }

      let userId: string | null = null;
      let sessionToken: string | null = null;
      let sessionId: Types.ObjectId | null = null;

      try {
        const result = await getAuth().api.getSession({
          headers: fromNodeHeaders(headers),
        });
        if (result?.user && Types.ObjectId.isValid(result.user.id)) {
          userId = result.user.id;
          sessionToken = result.session.token;
          if (Types.ObjectId.isValid(result.session.id)) {
            sessionId = new Types.ObjectId(result.session.id);
          }
        }
      } catch {
        // Better Auth getSession threw, fallback to direct DB lookup below
      }

      // Direct MongoDB fallback for Bearer tokens or if getSession returned null
      if (!userId && bearerToken && bearerToken.length > 0) {
        const rawToken = bearerToken.includes('.') ? bearerToken.split('.')[0] : bearerToken;
        const sessionDoc = await Session.findOne({
          token: rawToken,
          expiresAt: { $gt: new Date() },
        }).exec();

        if (sessionDoc && Types.ObjectId.isValid(sessionDoc.userId)) {
          userId = sessionDoc.userId.toString();
          sessionToken = sessionDoc.token;
          sessionId = sessionDoc._id;
        }
      }

      if (userId && Types.ObjectId.isValid(userId)) {
        const doc = await User.findById(userId).exec();
        if (doc && doc.status === 'active') {
          req.authUser = toAuthenticatedUser(doc);
          req.sessionToken = sessionToken ?? undefined;
          req.actor = actorFromUser(
            req.authUser,
            requestIp(req),
            requestUserAgent(req),
            req.requestId,
          );
          if (sessionId) {
            await slideSession(sessionId, doc.role);
          }
          const lastSeen = doc.lastSeenAt?.getTime() ?? 0;
          if (Date.now() - lastSeen > LAST_SEEN_INTERVAL_MS) {
            await User.updateOne({ _id: doc._id }, { $set: { lastSeenAt: new Date() } }).exec();
          }
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  })();
};

export const requireAuth: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const user = req.authUser;
  if (!user) {
    next(unauthenticated());
    return;
  }
  if (user.status !== 'active') {
    next(unauthenticated('This account has been deactivated.'));
    return;
  }
  if (!user.emailVerified) {
    next(emailUnverified());
    return;
  }
  next();
};

export const currentUser = (req: Request): AuthenticatedUser => {
  const user = req.authUser;
  if (!user) throw unauthenticated();
  return user;
};
