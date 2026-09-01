import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { accountUnlinked, forbidden } from '../lib/errors.js';
import { isUnlinkedClientAccount } from '../lib/scope.js';
import type { Capability } from './permissions.js';
import { isKnownCapability, roleHasCapability } from './permissions.js';
import { currentUser } from './requireAuth.js';

export interface CapabilityOptions {
  allowUnlinked?: boolean;
}

export const requireCapability = (
  capability: Capability,
  options: CapabilityOptions = {},
): RequestHandler => {
  const known = isKnownCapability(capability);
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!known) {
      next(forbidden('This route declares no capability and is therefore closed.'));
      return;
    }
    const user = currentUser(req);
    if (options.allowUnlinked !== true && isUnlinkedClientAccount(user)) {
      next(accountUnlinked());
      return;
    }
    if (!roleHasCapability(user.role, capability)) {
      next(forbidden());
      return;
    }
    next();
  };
};

export const failClosed: RequestHandler = (
  _req: Request,
  _res: Response,
  next: NextFunction,
) => {
  next(forbidden('This route declares no capability and is therefore closed.'));
};
