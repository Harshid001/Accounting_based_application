import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';

import { AppError, isAppError } from '../lib/errors.js';
import type { FieldError } from '../lib/errors.js';

interface MongoDuplicateError {
  code: number;
  keyPattern?: Record<string, unknown>;
}

const isDuplicateKeyError = (error: unknown): error is MongoDuplicateError =>
  error !== null &&
  typeof error === 'object' &&
  'code' in error &&
  error.code === 11000;

const duplicateFieldMessage = (field: string): string => {
  switch (field) {
    case 'pan':
      return 'That PAN already belongs to another client record.';
    case 'gstin':
      return 'That GSTIN already belongs to another client record.';
    case 'cin':
      return 'That CIN already belongs to another client record.';
    case 'email':
      return 'That email address is already in use.';
    case 'code':
      return 'That code is already used by another catalogue entry.';
    default:
      return 'Another record already holds this value.';
  }
};

const fromMongooseValidation = (error: MongooseError.ValidationError): AppError => {
  const details: FieldError[] = Object.entries(error.errors).map(([field, issue]) => ({
    field,
    message: issue.message,
  }));
  return new AppError(
    'VALIDATION_FAILED',
    'Some fields need attention before this can be saved.',
    details,
  );
};

const normalise = (error: unknown): AppError => {
  if (isAppError(error)) return error;

  if (error instanceof MongooseError.ValidationError) return fromMongooseValidation(error);

  if (error instanceof MongooseError.CastError) {
    return new AppError('VALIDATION_FAILED', 'That identifier is not in a valid form.', [
      { field: error.path, message: 'This value is not a valid identifier.' },
    ]);
  }

  if (isDuplicateKeyError(error)) {
    const field = Object.keys(error.keyPattern ?? {})[0] ?? 'value';
    return new AppError('CONFLICT', duplicateFieldMessage(field), [
      { field, message: duplicateFieldMessage(field) },
    ]);
  }

  if (
    error !== null &&
    typeof error === 'object' &&
    'type' in error &&
    error.type === 'entity.too.large'
  ) {
    return new AppError('PAYLOAD_TOO_LARGE', 'That request body is larger than 1 MB.');
  }

  return new AppError('INTERNAL', 'Something went wrong on our side.');
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const appError = normalise(error);
  const payload = {
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details ? { details: appError.details } : {}),
      requestId: req.requestId,
    },
  };

  const logPayload = {
    event: 'http.error',
    code: appError.code,
    status: appError.status,
    method: req.method,
    path: req.originalUrl.split('?')[0],
    err: error,
  };

  if (appError.status >= 500) {
    req.log.error(logPayload, 'request failed unexpectedly');
  } else if (appError.code === 'RATE_LIMITED' || appError.code === 'FORBIDDEN') {
    req.log.warn(logPayload, 'request refused');
  } else {
    req.log.debug(logPayload, 'request rejected');
  }

  res.status(appError.status).json(payload);
};
