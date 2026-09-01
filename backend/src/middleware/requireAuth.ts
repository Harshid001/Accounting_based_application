import { fromNodeHeaders } from 'better-auth/node';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Types } from 'mongoose';

import {
  SESSION_HARD_CAP_SECONDS,
  SESSION_LIFETIME_SECONDS,
  SESSION_REFRESH_AFTER_SECONDS,
  getAuth,
} from '../config/auth.js';
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
      const result = await getAuth().api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (result?.user && Types.ObjectId.isValid(result.user.id)) {
        const doc = await User.findById(result.user.id).exec();
        if (doc && doc.status === 'active') {
          req.authUser = toAuthenticatedUser(doc);
          req.sessionToken = result.session.token;
          req.actor = actorFromUser(
            req.authUser,
            requestIp(req),
            requestUserAgent(req),
            req.requestId,
          );
          if (Types.ObjectId.isValid(result.session.id)) {
            await slideSession(new Types.ObjectId(result.session.id), doc.role);
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
