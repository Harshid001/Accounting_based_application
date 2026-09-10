import type { Request, Response } from 'express';
import type { z } from 'zod';

import { databaseState } from '../config/db.js';
import { env } from '../config/env.js';
import { sendData } from '../lib/http.js';
import type { clientErrorBody } from '../validators/user.validators.js';

export const health = (req: Request, res: Response): void => {
  res.json({
    data: { status: 'ok', uptime: Math.round(process.uptime()), db: databaseState() },
    meta: { requestId: req.requestId },
  });
};

/**
 * Desktop shell version manifest (spec §5.4). Public on purpose: the desktop
 * app must learn its update fate BEFORE sign-in — an outdated shell gets a
 * hard update gate at login. minShellVersion is enforced client-side at
 * login and server-side on sensitive ops via the registered appVersion.
 */
export const desktopManifest = (_req: Request, res: Response): void => {
  sendData(
    res,
    {
      minShellVersion: env.DESKTOP_MIN_SHELL_VERSION,
      latestShellVersion: env.DESKTOP_LATEST_SHELL_VERSION,
      updateUrl: env.DESKTOP_UPDATE_URL,
    },
  );
};

const sanitizeLogLine = (val: string | undefined | null, maxLen: number): string => {
  if (typeof val !== 'string') return '';
  return Array.from(val)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('')
    .trim()
    .slice(0, maxLen);
};

export const reportClientError = async (
  input: { body: z.infer<typeof clientErrorBody> },
  ctx: { req: Request; res: Response; requestId: string },
): Promise<void> => {
  ctx.req.log.warn(
    {
      event: 'client.error',
      path: sanitizeLogLine(input.body.path, 500),
      message: sanitizeLogLine(input.body.message, 500),
      stack: input.body.stack?.slice(0, 2000) ?? null,
      userAgent: input.body.userAgent ? sanitizeLogLine(input.body.userAgent, 400) : null,
    },
    'the browser reported an unhandled error',
  );
  await Promise.resolve();
  sendData(ctx.res, { received: true });
};
