import { pino } from 'pino';

import { env, isProduction, isTest } from './env.js';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-active-client"]',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  'password',
  'newPassword',
  'currentPassword',
  '*.password',
  'token',
  '*.token',
  'secret',
  '*.secret',
  'aadhaar',
  '*.aadhaar',
  'aadhaarEncrypted',
  '*.aadhaarEncrypted',
  'uploadUrl',
  '*.uploadUrl',
  'downloadUrl',
  '*.downloadUrl',
  'url',
  '*.url',
];

export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  redact: { paths: redactPaths, censor: '[redacted]' },
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label) => ({ level: label }) },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino/file',
          options: { destination: 1 },
        },
      }),
});

export type Logger = typeof logger;
