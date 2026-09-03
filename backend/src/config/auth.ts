/*
 * Verified against better-auth@1.6.25 before this file was written.
 * 1. Package `better-auth`; init is `betterAuth(options)`; MongoDB adapter is
 *    `mongodbAdapter(db, config)` from `better-auth/adapters/mongodb`; the user model is
 *    extended through `user.additionalFields`, where `input: false` makes a field
 *    unsettable from a request body. The package is ESM-only, which is why this folder is.
 * 2. Per-role session lifetimes are NOT declarative: `session.expiresIn` is a single global
 *    value. Creation is narrowed by role in `databaseHooks.session.create.before`, and the
 *    sliding refresh is disabled here and performed per role in middleware/requireAuth.ts,
 *    which is the only place the role is known on a refresh.
 * 3. Collections are singular by default: `user`, `session`, `account`, `verification`.
 *    The adapter maps `id` <-> `_id` as a real ObjectId, so Mongoose addresses the same
 *    `user` collection for profile fields with no bridge collection.
 * 4. Default password hashing is scrypt (better-auth owns it; no bcrypt here).
 */
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { APIError, createAuthMiddleware } from 'better-auth/api';

import { checkPassword, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../lib/passwordPolicy.js';
import { appLink } from '../email/send.js';
import { recordAudit } from '../services/audit.service.js';
import { renderResetPassword } from '../email/templates/resetPassword.js';
import { renderVerifyEmail } from '../email/templates/verifyEmail.js';
import { sendMail } from '../email/send.js';
import { User } from '../models/user.model.js';
import { env, googleOAuthConfigured, isProduction, isTest } from './env.js';
import { getDb } from './db.js';
import { logger } from './logger.js';

export const SESSION_LIFETIME_SECONDS = {
  admin: 60 * 60 * 24 * 7,
  staff: 60 * 60 * 24 * 7,
  client: 60 * 60 * 24 * 30,
} as const;

export const SESSION_HARD_CAP_SECONDS = 60 * 60 * 24 * 90;
export const SESSION_REFRESH_AFTER_SECONDS = 60 * 60 * 24;

const readString = (source: unknown, key: string): string | null => {
  if (source === null || typeof source !== 'object') return null;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
};

const PASSWORD_PATHS = new Set(['/sign-up/email', '/reset-password', '/change-password']);

const passwordPolicyGate = createAuthMiddleware(async (ctx) => {
  if (!PASSWORD_PATHS.has(ctx.path)) return;
  const password = readString(ctx.body, 'password') ?? readString(ctx.body, 'newPassword');
  if (password === null) return;
  const email = readString(ctx.body, 'email');
  const context = [email, email?.split('@')[0] ?? null, readString(ctx.body, 'name')].filter(
    (value): value is string => value !== null,
  );
  const verdict = checkPassword(password, context);
  if (!verdict.ok) {
    throw new APIError('BAD_REQUEST', { message: verdict.message, code: 'WEAK_PASSWORD' });
  }
  await Promise.resolve();
});

const resolveCookieDomain = (): string | undefined => {
  if (env.SESSION_COOKIE_DOMAIN) {
    const raw = env.SESSION_COOKIE_DOMAIN.trim();
    return raw.startsWith('.') ? raw : `.${raw}`;
  }
  if (isProduction) {
    try {
      const parsed = new URL(env.APP_BASE_URL);
      const parts = parsed.hostname.split('.');
      if (parts.length >= 2) {
        return `.${parts.slice(-2).join('.')}`;
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const resolvedCookieDomain = resolveCookieDomain();

let instance: ReturnType<typeof buildAuth> | null = null;

const buildAuth = () =>
  betterAuth({
    appName: 'FirmDesk',
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    database: mongodbAdapter(getDb(), { transaction: false }),
    trustedOrigins: [...new Set([...env.CORS_ORIGINS, env.APP_BASE_URL, env.BETTER_AUTH_URL])],
    rateLimit: { enabled: false },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, url }) => {
        if (env.NODE_ENV === 'development') {
          logger.info(
            { event: 'auth.reset_password_url', email: user.email, url },
            `Password reset URL for ${user.email}: ${url}`,
          );
        }
        await sendMail({
          to: user.email,
          category: 'password_reset',
          rendered: renderResetPassword({
            firmName: 'your accounting firm',
            recipientName: user.name,
            resetUrl: url,
          }),
        });
      },
    },
    emailVerification: {
      sendOnSignUp: isTest,
      sendOnSignIn: false,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => {
        if (env.NODE_ENV === 'development') {
          logger.info(
            { event: 'auth.verify_url', email: user.email, url },
            `Email verification URL for ${user.email}: ${url}`,
          );
        }
        await sendMail({
          to: user.email,
          category: 'verification',
          rendered: renderVerifyEmail({
            firmName: 'your accounting firm',
            recipientName: user.name,
            verifyUrl: url,
          }),
        });
      },
    },
    ...(googleOAuthConfigured
      ? {
          socialProviders: {
            google: {
              clientId: env.GOOGLE_CLIENT_ID ?? '',
              clientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
            },
          },
        }
      : {}),
    user: {
      additionalFields: {
        role: { type: 'string', required: false, defaultValue: 'client', input: false },
        status: { type: 'string', required: false, defaultValue: 'active', input: false },
        linkedClients: { type: 'string[]', required: false, defaultValue: [], input: false },
        pinnedClients: { type: 'string[]', required: false, defaultValue: [], input: false },
      },
    },
    session: {
      expiresIn: SESSION_LIFETIME_SECONDS.client,
      updateAge: SESSION_REFRESH_AFTER_SECONDS,
      disableSessionRefresh: true,
    },
    advanced: {
      useSecureCookies: isProduction,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: env.SESSION_COOKIE_SAMESITE,
        secure: isProduction || env.SESSION_COOKIE_SAMESITE === 'none',
        path: '/',
        ...(resolvedCookieDomain !== undefined ? { domain: resolvedCookieDomain } : {}),
      },
      ...(resolvedCookieDomain !== undefined
        ? { crossSubDomainCookies: { enabled: true, domain: resolvedCookieDomain } }
        : {}),
    },
    hooks: { before: passwordPolicyGate },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            await Promise.resolve();
            return {
              data: {
                ...user,
                role: 'client',
                status: 'active',
                ...(isTest ? {} : { emailVerified: true }),
              },
            };
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const owner = await User.findById(session.userId)
              .select('role')
              .lean<{ role: keyof typeof SESSION_LIFETIME_SECONDS } | null>()
              .exec();
            const lifetime =
              SESSION_LIFETIME_SECONDS[owner?.role ?? 'client'] ??
              SESSION_LIFETIME_SECONDS.client;
            return {
              data: { ...session, expiresAt: new Date(Date.now() + lifetime * 1000) },
            };
          },
          after: async (session) => {
            const owner = await User.findById(session.userId)
              .select('role')
              .lean<{ role: 'admin' | 'staff' | 'client' } | null>()
              .exec();
            await recordAudit({
              actor: {
                id: session.userId as unknown as null,
                role: owner?.role ?? 'client',
                ip: typeof session.ipAddress === 'string' ? session.ipAddress : null,
                userAgent: typeof session.userAgent === 'string' ? session.userAgent : null,
                requestId: null,
              },
              action: 'sign_in',
              entityKind: 'session',
              summary: 'Signed in',
            });
          },
        },
      },
    },
  });

export const initAuth = (): ReturnType<typeof buildAuth> => {
  instance ??= buildAuth();
  logger.info(
    { event: 'auth.ready', google: googleOAuthConfigured },
    'session authority initialised',
  );
  return instance;
};

export const getAuth = (): ReturnType<typeof buildAuth> => {
  if (!instance) {
    throw new Error('Auth is not initialised. Call initAuth() after connecting the database.');
  }
  return instance;
};

export const resetAuthForTests = (): void => {
  instance = null;
};

export const verificationRedirect = (): string => appLink('/verify-email');
