import { hashPassword } from 'better-auth/crypto';

import { getAuth } from '../config/auth.js';
import { getDb } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { checkPassword } from '../lib/passwordPolicy.js';
import { User } from '../models/user.model.js';

interface PermanentCredential {
  email: string;
  password: string;
  role: 'admin' | 'staff';
  name: string;
}

const PERMANENT_ACCOUNTS: PermanentCredential[] = [
  {
    email: 'harshidsoni01@gmail.com',
    password: 'Harshid@123',
    role: 'admin',
    name: 'Harshid Soni (Admin)',
  },
  {
    email: 'harshidsoni@gmail.com',
    password: 'Harshid@123',
    role: 'admin',
    name: 'Harshid Soni (Admin)',
  },
  {
    email: 'staff@gmail.com',
    password: 'Staff@123',
    role: 'staff',
    name: 'Practice Staff',
  },
];

async function ensurePermanentAccounts(): Promise<void> {
  const db = getDb();
  const now = new Date();

  for (const cred of PERMANENT_ACCOUNTS) {
    const normalizedEmail = cred.email.trim().toLowerCase();
    const hashedPassword = await hashPassword(cred.password);

    let user = await User.findOne({ email: normalizedEmail }).exec();
    if (!user) {
      user = await User.create({
        email: normalizedEmail,
        name: cred.name,
        role: cred.role,
        status: 'active',
        emailVerified: true,
        linkedClients: [],
        pinnedClients: [],
        createdAt: now,
        updatedAt: now,
      });
      logger.info({ event: 'bootstrap.created_permanent', email: normalizedEmail, role: cred.role }, 'created user');
    } else {
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            role: cred.role,
            status: 'active',
            emailVerified: true,
            updatedAt: now,
          },
        },
      ).exec();
    }

    const existingAccount = await db.collection('account').findOne({
      userId: user._id,
      providerId: 'credential',
    });

    if (existingAccount) {
      await db.collection('account').updateOne(
        { _id: existingAccount._id },
        {
          $set: {
            password: hashedPassword,
            updatedAt: now,
          },
        },
      );
    } else {
      await db.collection('account').insertOne({
        userId: user._id,
        accountId: user._id.toString(),
        providerId: 'credential',
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

export const bootstrapAdmin = async (): Promise<{ created: boolean }> => {
  await ensurePermanentAccounts();

  const email = env.BOOTSTRAP_ADMIN_EMAIL;
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = env.BOOTSTRAP_ADMIN_NAME;

  if (email === undefined || email === '') {
    return { created: true };
  }

  const normalizedEmail = email.toLowerCase().trim();

  const anyAdmin = await User.findOne({ role: 'admin' }).select('_id').lean().exec();
  if (anyAdmin) return { created: true };

  const existingUser = await User.findOne({ email: normalizedEmail }).exec();
  if (existingUser) {
    if (existingUser.role !== 'admin') {
      await User.updateOne(
        { _id: existingUser._id },
        { $set: { role: 'admin', status: 'active', emailVerified: true } },
      ).exec();
      logger.info(
        { event: 'bootstrap.promoted', email: normalizedEmail },
        'existing user promoted to administrator role',
      );
      return { created: true };
    }
    return { created: true };
  }

  if (password === undefined || name === undefined) {
    return { created: true };
  }

  const verdict = checkPassword(password, [normalizedEmail, name]);
  if (!verdict.ok) {
    logger.error(
      { event: 'bootstrap.rejected' },
      `BOOTSTRAP_ADMIN_PASSWORD was refused: ${verdict.message}`,
    );
    return { created: false };
  }

  try {
    await getAuth().api.signUpEmail({ body: { email, password, name } });
  } catch (error) {
    logger.error(
      { event: 'bootstrap.failed', err: error },
      'the first admin could not be created',
    );
    return { created: false };
  }

  await User.updateOne(
    { email: email.toLowerCase() },
    { $set: { role: 'admin', status: 'active', emailVerified: true, linkedClients: [] } },
  ).exec();

  logger.info(
    { event: 'bootstrap.created' },
    'the first administrator was created from environment values',
  );
  return { created: true };
};
