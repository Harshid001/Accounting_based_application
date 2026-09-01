import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { ZodError } from 'zod';

import { forbidden, validationFailed } from '../lib/errors.js';
import type { FieldError } from '../lib/errors.js';
import type { AuthenticatedUser, RequestActor } from '../types/context.js';
import { currentUser } from './requireAuth.js';
import { scopedClientId } from './requireClientScope.js';
import type { Types } from 'mongoose';

export interface RouteSchemas {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
  rejectBodyKeys?: readonly string[];
  adminOnlyBodyKeys?: readonly string[];
}

type Parsed<S extends ZodType | undefined> = S extends ZodType
  ? ReturnType<S['parse']>
  : Record<string, never>;

export interface ValidatedInput<S extends RouteSchemas> {
  params: Parsed<S['params']>;
  query: Parsed<S['query']>;
  body: Parsed<S['body']>;
}

export interface RouteContext {
  req: Request;
  res: Response;
  user: AuthenticatedUser;
  actor: RequestActor;
  requestId: string;
  clientId: () => Types.ObjectId;
}

const zodToFieldErrors = (error: ZodError, prefix: string): FieldError[] =>
  error.issues.map((issue) => ({
    field: [prefix, ...issue.path.map((segment) => String(segment))]
      .filter((segment) => segment.length > 0)
      .join('.'),
    message: issue.message,
  }));

const parseSection = <S extends ZodType | undefined>(
  schema: S,
  value: unknown,
  prefix: string,
  errors: FieldError[],
): Parsed<S> => {
  if (schema === undefined) return {} as Parsed<S>;
  const result = schema.safeParse(value);
  if (!result.success) {
    errors.push(...zodToFieldErrors(result.error, prefix));
    return {} as Parsed<S>;
  }
  return result.data as Parsed<S>;
};

const bodyKeys = (body: unknown): string[] =>
  body !== null && typeof body === 'object' ? Object.keys(body) : [];

export const handle = <S extends RouteSchemas>(
  schemas: S,
  controller: (input: ValidatedInput<S>, ctx: RouteContext) => Promise<void>,
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      try {
        const user = currentUser(req);
        const present = bodyKeys(req.body);

        const rejected = (schemas.rejectBodyKeys ?? []).filter((key) => present.includes(key));
        if (rejected.length > 0) {
          throw forbidden(
            `You cannot set ${rejected.join(', ')} on this request. Use the dedicated endpoint for that field.`,
          );
        }

        if (user.role !== 'admin') {
          const privileged = (schemas.adminOnlyBodyKeys ?? []).filter((key) =>
            present.includes(key),
          );
          if (privileged.length > 0) {
            throw forbidden(
              `Only an administrator can change ${privileged.join(', ')}. Ask an administrator to make this change.`,
            );
          }
        }

        const errors: FieldError[] = [];
        const input = {
          params: parseSection(schemas.params, req.params, 'params', errors),
          query: parseSection(schemas.query, req.query, 'query', errors),
          body: parseSection(schemas.body, req.body, 'body', errors),
        } as ValidatedInput<S>;

        if (errors.length > 0) {
          throw validationFailed('Some fields need attention before this can be saved.', errors);
        }

        const actor = req.actor;
        if (actor === undefined) throw forbidden();

        await controller(input, {
          req,
          res,
          user,
          actor,
          requestId: req.requestId,
          clientId: () => scopedClientId(req),
        });
      } catch (error) {
        if (error instanceof ZodError) {
          next(validationFailed('Some fields need attention.', zodToFieldErrors(error, '')));
          return;
        }
        next(error);
      }
    })();
  };
};

export const handlePublic = <S extends RouteSchemas>(
  schemas: S,
  controller: (
    input: ValidatedInput<S>,
    ctx: { req: Request; res: Response; requestId: string },
  ) => Promise<void>,
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      try {
        const errors: FieldError[] = [];
        const input = {
          params: parseSection(schemas.params, req.params, 'params', errors),
          query: parseSection(schemas.query, req.query, 'query', errors),
          body: parseSection(schemas.body, req.body, 'body', errors),
        } as ValidatedInput<S>;
        if (errors.length > 0) {
          throw validationFailed('Some fields need attention.', errors);
        }
        await controller(input, { req, res, requestId: req.requestId });
      } catch (error) {
        next(error);
      }
    })();
  };
};
