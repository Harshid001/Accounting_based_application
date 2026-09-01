import type { Response } from 'express';

import type { PageMeta } from './pagination.js';

export const sendData = <T>(
  res: Response,
  data: T,
  extraMeta: Record<string, unknown> = {},
): void => {
  res.json({ data, meta: { requestId: res.req.requestId, ...extraMeta } });
};

export const sendCreated = <T>(res: Response, data: T): void => {
  res.status(201).json({ data, meta: { requestId: res.req.requestId } });
};

export const sendList = <T>(
  res: Response,
  items: readonly T[],
  page: PageMeta,
  extraMeta: Record<string, unknown> = {},
): void => {
  res.json({
    data: items,
    meta: { requestId: res.req.requestId, ...page, ...extraMeta },
  });
};

export const sendNoContent = (res: Response): void => {
  res.status(204).end();
};

export const sendCsv = (res: Response, filename: string, body: string): void => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(`\uFEFF${body}`);
};
