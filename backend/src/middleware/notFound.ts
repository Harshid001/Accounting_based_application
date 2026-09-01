import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AppError } from '../lib/errors.js';

export const notFoundHandler: RequestHandler = (
  _req: Request,
  _res: Response,
  next: NextFunction,
) => {
  next(new AppError('NOT_FOUND', 'That endpoint does not exist.'));
};
