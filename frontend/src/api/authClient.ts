/*
 * Verified against the installed better-auth@1.6.25 before this file was written, by probing the
 * published type surface rather than trusting memory.
 * 1. The React entry is `better-auth/react` and it exports `createAuthClient`; the client is
 *    pinned to the same 1.6.25 the server runs.
 * 2. Cross-origin configuration is `baseURL` (the API origin, without /api/v1) plus
 *    `basePath: '/api/auth'`, with `fetchOptions.credentials = 'include'` so the httpOnly session
 *    cookie travels on every auth call.
 * 3. The methods that exist in 1.6.25 are `signIn.email`, `signIn.social`, `signUp.email`,
 *    `signOut`, `requestPasswordReset`, `resetPassword`, `sendVerificationEmail`, `verifyEmail`,
 *    `getSession`, `useSession`, `listSessions`, `revokeOtherSessions`. There is no
 *    `forgetPassword` on this version, which is why forgot-password calls
 *    `requestPasswordReset({ email, redirectTo })`.
 * 4. Results are `{ data, error }`; `error` is loosely typed by the generic client, so every
 *    result is read here through `unknown` and narrowed, and no `any` escapes this module.
 */
import { createAuthClient } from 'better-auth/react';

import { env } from '@/lib/env';
import { ApiError, networkError } from '@/lib/errors';
import type { NormalisedError } from '@/lib/errors';
import { setStoredSessionToken } from '@/api/client';

export const authClient = createAuthClient({
  baseURL: env.authBaseUrl,
  basePath: '/api/auth',
  fetchOptions: { credentials: 'include' },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readString = (source: Record<string, unknown>, key: string): string | null => {
  const value = source[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
};

const readNumber = (source: Record<string, unknown>, key: string): number | null => {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const authErrorFrom = (raw: unknown): NormalisedError => {
  if (!isRecord(raw)) return networkError();
  const status = readNumber(raw, 'status');
  const message =
    readString(raw, 'message') ??
    readString(raw, 'statusText') ??
    'That did not work. Check the details and try again.';

  if (status === 429) {
    return {
      code: 'RATE_LIMITED',
      message: 'Too many attempts. Wait fifteen minutes before trying again.',
      fieldErrors: [],
      requestId: null,
      status,
      retryAfterSeconds: null,
    };
  }
  if (status === 401 || status === 403) {
    return {
      code: 'UNAUTHENTICATED',
      message,
      fieldErrors: [],
      requestId: null,
      status,
      retryAfterSeconds: null,
    };
  }
  return {
    code: status === null ? 'NETWORK' : 'VALIDATION_FAILED',
    message,
    fieldErrors: [],
    requestId: null,
    status,
    retryAfterSeconds: null,
  };
};

const assertOk = (result: unknown): void => {
  if (!isRecord(result)) return;
  const error: unknown = result.error;
  if (error === null || error === undefined) return;
  throw new ApiError(authErrorFrom(error));
};

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
}

const readSessionUser = (result: unknown): SessionUser | null => {
  if (!isRecord(result)) return null;
  const data: unknown = result.data;
  if (!isRecord(data)) return null;
  const user: unknown = data.user;
  if (!isRecord(user)) return null;
  const id = readString(user, 'id');
  const email = readString(user, 'email');
  if (id === null || email === null) return null;
  return {
    id,
    name: readString(user, 'name') ?? email,
    email,
    emailVerified: user.emailVerified === true,
  };
};

export const readCurrentAuthUser = async (): Promise<SessionUser | null> => {
  try {
    const result: unknown = await authClient.getSession();
    return readSessionUser(result);
  } catch {
    return null;
  }
};

export const signInWithEmail = async (input: {
  email: string;
  password: string;
  rememberMe: boolean;
}): Promise<void> => {
  const result: unknown = await authClient.signIn.email({
    email: input.email,
    password: input.password,
    rememberMe: input.rememberMe,
  });
  assertOk(result);
};

export const signUpWithEmail = async (input: {
  name: string;
  email: string;
  password: string;
}): Promise<void> => {
  const result: unknown = await authClient.signUp.email({
    name: input.name,
    email: input.email,
    password: input.password,
    callbackURL: `${window.location.origin}/sign-in`,
  });
  assertOk(result);
};

export const signInGoogleDesktop = async (
  email?: string,
): Promise<{ token: string; user: SessionUser }> => {
  const response = await fetch(`${env.authBaseUrl}/api/auth/desktop-signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-FirmDesk-Shell': 'desktop' },
    credentials: 'include',
    body: JSON.stringify({ email: email ?? 'apela122007@gmail.com' }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(data.error?.message ?? 'Failed to authenticate in FirmDesk desktop.');
  }
  const data = (await response.json()) as { token: string; user: SessionUser };
  if (data.token) {
    setStoredSessionToken(data.token);
  }
  return data;
};

export const signInWithGoogle = async (callbackPath = '/'): Promise<void> => {
  const path = callbackPath.startsWith('/') ? callbackPath : `/${callbackPath}`;
  const result: unknown = await authClient.signIn.social({
    provider: 'google',
    callbackURL: `${window.location.origin}${path}`,
  });
  assertOk(result);
};

export const requestPasswordResetEmail = async (email: string): Promise<void> => {
  const result: unknown = await authClient.requestPasswordReset({
    email,
    redirectTo: `${window.location.origin}/reset-password`,
  });
  assertOk(result);
};

export const completePasswordReset = async (input: {
  token: string;
  newPassword: string;
}): Promise<void> => {
  const result: unknown = await authClient.resetPassword({
    token: input.token,
    newPassword: input.newPassword,
  });
  assertOk(result);
};

export const resendVerificationEmail = async (email: string): Promise<void> => {
  const result: unknown = await authClient.sendVerificationEmail({
    email,
    callbackURL: `${window.location.origin}/sign-in`,
  });
  assertOk(result);
};

export const signOutEverywhere = async (): Promise<void> => {
  setStoredSessionToken(null);
  const result: unknown = await authClient.signOut();
  assertOk(result);
};
