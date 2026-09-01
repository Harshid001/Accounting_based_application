import { pipeline } from 'node:stream/promises';

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';

import {
  openObject,
  storeObject,
  verifyDownloadTicket,
  verifyUploadTicket,
} from '../config/fileStorage.js';
import { unsupportedMediaType, validationFailed } from '../lib/errors.js';
import { downloadTransferLimiter, uploadLimiter } from '../middleware/rateLimit.js';
import { handlePublic } from '../middleware/validate.js';

export const storageRouter: Router = Router();

const transferQuery = z.object({
  token: z.string().min(1).max(2_000),
});

const requestContentType = (req: Request): string =>
  (req.headers['content-type'] ?? '').split(';')[0]?.trim() ?? '';

const requestContentLength = (req: Request): number | null => {
  const raw = req.headers['content-length'];
  if (raw === undefined) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
};

const contentDisposition = (filename: string): string => {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'download';
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
};

storageRouter.put(
  '/storage/transfers/upload',
  uploadLimiter,
  handlePublic({ query: transferQuery }, async (input, ctx) => {
    const ticket = verifyUploadTicket(input.query.token);
    if (requestContentType(ctx.req) !== ticket.mimeType) {
      throw unsupportedMediaType('The uploaded file type does not match its transfer ticket.');
    }
    const contentLength = requestContentLength(ctx.req);
    if (contentLength !== null && contentLength !== ticket.sizeBytes) {
      throw validationFailed('The uploaded file size does not match its transfer ticket.');
    }
    await storeObject(ticket.storageKey, ticket.mimeType, ticket.sizeBytes, ctx.req);
    ctx.res.status(204).end();
  }),
);

storageRouter.get(
  '/storage/transfers/download',
  downloadTransferLimiter,
  handlePublic({ query: transferQuery }, async (input, ctx) => {
    const ticket = verifyDownloadTicket(input.query.token);
    const stored = await openObject(ticket.storageKey);
    const response: Response = ctx.res;
    response.status(200);
    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('Content-Length', stored.contentLength.toString());
    response.setHeader('Content-Disposition', contentDisposition(ticket.downloadFilename));
    await pipeline(stored.stream, response);
  }),
);
