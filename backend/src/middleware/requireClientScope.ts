import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Types } from 'mongoose';

import { notFound } from '../lib/errors.js';
import { containsId, isObjectId } from '../lib/scope.js';
import { Client } from '../models/client.model.js';
import type { AuthenticatedUser } from '../types/context.js';
import { currentUser } from './requireAuth.js';

export const ACTIVE_CLIENT_HEADER = 'x-active-client';

export type ScopeSource =
  | 'param:id'
  | 'param:clientId'
  | 'body:clientId'
  | 'query:client'
  | 'header';

const readSource = (req: Request, source: ScopeSource): string | null => {
  switch (source) {
    case 'param:id':
      return typeof req.params.id === 'string' ? req.params.id : null;
    case 'param:clientId':
      return typeof req.params.clientId === 'string' ? req.params.clientId : null;
    case 'body:clientId': {
      const body: unknown = req.body;
      if (body === null || typeof body !== 'object') return null;
      const value = (body as Record<string, unknown>).clientId;
      return typeof value === 'string' ? value : null;
    }
    case 'query:client': {
      const value = req.query.client;
      return typeof value === 'string' ? value : null;
    }
    case 'header': {
      const value = req.headers[ACTIVE_CLIENT_HEADER];
      return typeof value === 'string' ? value : null;
    }
  }
};

export const activeClientHeader = (req: Request): string | null =>
  readSource(req, 'header');

export const assertClientAccess = async (
  user: AuthenticatedUser,
  clientId: string,
): Promise<Types.ObjectId> => {
  if (!isObjectId(clientId)) throw notFound('client');
  const id = new Types.ObjectId(clientId);

  if (user.role === 'client') {
    if (!containsId(user.linkedClients, id)) throw notFound('client');
    return id;
  }

  const record = await Client.findById(id).select('_id assignedStaff').lean().exec();
  if (!record) throw notFound('client');
  if (user.role === 'admin') return id;
  if (!containsId(record.assignedStaff, user.id)) throw notFound('client');
  return id;
};

export interface ScopeOptions {
  optional?: boolean;
}

export const requireClientScope = (
  source: ScopeSource,
  options: ScopeOptions = {},
): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction) => {
    void (async () => {
      try {
        const user = currentUser(req);
        const header = activeClientHeader(req);
        let target = readSource(req, source);

        if (user.role === 'client') {
          if (header === null) throw notFound('client');
          if (target !== null && target !== header) throw notFound('client');
          target = header;
        }

        if (target === null) {
          if (options.optional === true) {
            next();
            return;
          }
          throw notFound('client');
        }

        req.scopedClientId = await assertClientAccess(user, target);
        next();
      } catch (error) {
        next(error);
      }
    })();
  };
};

export const scopedClientId = (req: Request): Types.ObjectId => {
  const id = req.scopedClientId;
  if (!id) throw notFound('client');
  return id;
};

export type ClientResolver = (recordId: Types.ObjectId) => Promise<Types.ObjectId | null>;

export const requireResolvedClientScope = (
  resolve: ClientResolver,
  paramName = 'id',
): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction) => {
    void (async () => {
      try {
        const user = currentUser(req);
        const raw = req.params[paramName];
        if (typeof raw !== 'string' || !isObjectId(raw)) throw notFound('record');
        const owningClient = await resolve(new Types.ObjectId(raw));
        if (owningClient === null) {
          if (user.role === 'admin') {
            next();
            return;
          }
          throw notFound('record');
        }
        const header = activeClientHeader(req);
        if (user.role === 'client' && header !== null && header !== owningClient.toString()) {
          throw notFound('record');
        }
        req.scopedClientId = await assertClientAccess(user, owningClient.toString());
        next();
      } catch (error) {
        next(error);
      }
    })();
  };
};
