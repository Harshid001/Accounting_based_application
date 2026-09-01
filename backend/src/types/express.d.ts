import type { Types } from 'mongoose';

import type { Logger } from '../config/logger.js';
import type { AuthenticatedUser, RequestActor } from './context.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      log: Logger;
      authUser?: AuthenticatedUser;
      actor?: RequestActor;
      scopedClientId?: Types.ObjectId;
      sessionToken?: string;
      authEmail?: string;
    }
  }
}

export {};
