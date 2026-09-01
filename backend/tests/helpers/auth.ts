import type { Express } from 'express';
import type { Types } from 'mongoose';

import { createApp } from '../../src/app.js';
import { getAuth } from '../../src/config/auth.js';
import type { Role } from '../../src/lib/enums.js';
import { User } from '../../src/models/user.model.js';

export interface TestAccount {
  id: Types.ObjectId;
  email: string;
  name: string;
  cookie: string;
  role: Role;
}

let cached: Express | null = null;

export const app = (): Express => {
  cached ??= createApp();
  return cached;
};

export const resetAppCache = (): void => {
  cached = null;
};

export const STRONG_PASSWORD = 'quiet ledger monsoon 42 tally';

let counter = 0;

export const uniqueEmail = (prefix: string): string => {
  counter += 1;
  return `${prefix}.${counter}.${Date.now().toString(36)}@firmdesk.test`;
};

export interface CreateAccountOptions {
  role?: Role;
  name?: string;
  email?: string;
  password?: string;
  emailVerified?: boolean;
  linkedClients?: Types.ObjectId[];
  status?: 'active' | 'deactivated';
}

export const createAccount = async (
  options: CreateAccountOptions = {},
): Promise<TestAccount> => {
  const role = options.role ?? 'client';
  const email = options.email ?? uniqueEmail(role);
  const name = options.name ?? `${role} tester`;
  const password = options.password ?? STRONG_PASSWORD;

  const response = await getAuth().api.signUpEmail({
    body: { email, password, name },
    asResponse: true,
  });
  if (response.status >= 400) {
    throw new Error(`sign-up failed for ${email}: ${response.status.toString()}`);
  }

  await User.updateOne(
    { email: email.toLowerCase() },
    {
      $set: {
        role,
        status: options.status ?? 'active',
        emailVerified: options.emailVerified ?? true,
        linkedClients: role === 'client' ? (options.linkedClients ?? []) : [],
      },
    },
  ).exec();

  const record = await User.findOne({ email: email.toLowerCase() }).select('_id').lean().exec();
  if (!record) throw new Error(`account ${email} vanished after sign-up`);

  const signIn = await getAuth().api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  const setCookie = signIn.headers.get('set-cookie');
  if (setCookie === null) throw new Error(`no session cookie returned for ${email}`);
  const cookie = setCookie
    .split(/,(?=[^;]+?=)/)
    .map((part) => part.split(';')[0]?.trim() ?? '')
    .filter((part) => part.length > 0)
    .join('; ');

  return { id: record._id, email, name, cookie, role };
};

export const linkClients = async (
  account: TestAccount,
  clientIds: Types.ObjectId[],
): Promise<void> => {
  await User.updateOne({ _id: account.id }, { $set: { linkedClients: clientIds } }).exec();
};

export const auth = (account: TestAccount): { Cookie: string } => ({ Cookie: account.cookie });

export const authWithClient = (
  account: TestAccount,
  clientId: Types.ObjectId | string,
): { Cookie: string; 'X-Active-Client': string } => ({
  Cookie: account.cookie,
  'X-Active-Client': clientId.toString(),
});
