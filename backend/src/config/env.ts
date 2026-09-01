import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv({ quiet: true });

const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((value) => value === true || value === 'true' || value === '1');

const originList = z
  .string()
  .min(1, 'must list at least one origin')
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  .refine((origins) => origins.length > 0, 'must list at least one origin')
  .refine(
    (origins) => origins.every((origin) => origin !== '*' && !origin.includes('*')),
    'a wildcard origin is never accepted, in any environment',
  )
  .refine(
    (origins) => origins.every((origin) => /^https?:\/\/[^/]+$/.test(origin)),
    'each origin must be a bare scheme + host, with no trailing path',
  );

const base64Key = (bytes: number) =>
  z
    .string()
    .min(1)
    .refine((value) => {
      try {
        return Buffer.from(value, 'base64').length === bytes;
      } catch {
        return false;
      }
    }, `must be ${bytes} bytes encoded as base64`);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  MONGODB_URI: z.string().min(1).startsWith('mongodb'),

  APP_BASE_URL: z.url(),
  CORS_ORIGINS: originList,

  BETTER_AUTH_SECRET: z.string().min(32, 'must be at least 32 characters'),
  BETTER_AUTH_URL: z.url(),
  SESSION_COOKIE_DOMAIN: z.string().optional(),
  SESSION_COOKIE_SAMESITE: z.enum(['lax', 'none', 'strict']).default('lax'),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  FIELD_ENCRYPTION_KEY: base64Key(32),
  FIELD_ENCRYPTION_KEY_VERSION: z.coerce.number().int().min(1).default(1),
  FIELD_ENCRYPTION_KEY_PREVIOUS: base64Key(32).optional(),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_SECURE: booleanish.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().min(3),

  SCHEDULER_ENABLED: booleanish.default(false),
  SCHEDULER_TIMEZONE: z.string().min(1).default('Asia/Kolkata'),
  COMPLIANCE_HORIZON_DAYS: z.coerce.number().int().min(1).max(1095).default(120),

  BOOTSTRAP_ADMIN_EMAIL: z.union([z.email(), z.literal('')]).optional(),
  BOOTSTRAP_ADMIN_NAME: z.string().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

const blankToUndefined = (source: NodeJS.ProcessEnv): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && value.trim() !== '') out[key] = value;
  }
  return out;
};

const parsed = schema.safeParse(blankToUndefined(process.env));

if (!parsed.success) {
  const lines = parsed.error.issues.map((issue) => {
    const path = issue.path.join('.') || '(root)';
    return `  ${path}: ${issue.message}`;
  });
  process.stderr.write(
    [
      'FirmDesk API cannot start: the environment is incomplete or invalid.',
      'Fix every line below, then start again. See .env.example for the full list.',
      ...lines,
      '',
    ].join('\n'),
  );
  process.exit(1);
}

const value = parsed.data;

if ((value.GOOGLE_CLIENT_ID === undefined) !== (value.GOOGLE_CLIENT_SECRET === undefined)) {
  process.stderr.write(
    'FirmDesk API cannot start: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together.\n',
  );
  process.exit(1);
}

if (value.NODE_ENV === 'production' && value.SESSION_COOKIE_SAMESITE === 'none') {
  const insecure = value.CORS_ORIGINS.filter((origin) => origin.startsWith('http://'));
  if (insecure.length > 0) {
    process.stderr.write(
      `FirmDesk API cannot start: SameSite=None requires https origins, but CORS_ORIGINS contains ${insecure.join(', ')}.\n`,
    );
    process.exit(1);
  }
}

export const env: Env = value;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const googleOAuthConfigured =
  env.GOOGLE_CLIENT_ID !== undefined && env.GOOGLE_CLIENT_SECRET !== undefined;
