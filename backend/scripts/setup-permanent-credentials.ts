import fs from 'node:fs';
import path from 'node:path';
import { hashPassword, verifyPassword } from 'better-auth/crypto';

import { connectDatabase, disconnectDatabase, getDb } from '../src/config/db.js';
import { getAuth, initAuth } from '../src/config/auth.js';
import { logger } from '../src/config/logger.js';
import { User } from '../src/models/user.model.js';

interface CredentialSpec {
  email: string;
  password: string;
  role: 'admin' | 'staff';
  name: string;
}

const CREDENTIALS: CredentialSpec[] = [
  {
    email: 'harshidsoni01@gmail.com',
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

async function configureAccount(spec: CredentialSpec): Promise<void> {
  const db = getDb();
  const normalizedEmail = spec.email.trim().toLowerCase();
  const now = new Date();

  logger.info({ email: normalizedEmail, role: spec.role }, 'provisioning account');

  const hashedPassword = await hashPassword(spec.password);
  const isValid = await verifyPassword({ hash: hashedPassword, password: spec.password });
  if (!isValid) {
    throw new Error(`Password hash verification failed for ${normalizedEmail}`);
  }

  let user = await User.findOne({ email: normalizedEmail }).exec();
  if (!user) {
    user = await User.create({
      email: normalizedEmail,
      name: spec.name,
      role: spec.role,
      status: 'active',
      emailVerified: true,
      linkedClients: [],
      pinnedClients: [],
      createdAt: now,
      updatedAt: now,
    });
    logger.info({ email: normalizedEmail, id: user._id.toString() }, 'created user document');
  } else {
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          role: spec.role,
          status: 'active',
          emailVerified: true,
          updatedAt: now,
        },
      },
    ).exec();
    logger.info({ email: normalizedEmail, id: user._id.toString() }, 'updated user document');
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
    logger.info({ accountId: existingAccount._id.toString() }, 'updated existing credential account');
  } else {
    const inserted = await db.collection('account').insertOne({
      userId: user._id,
      accountId: user._id.toString(),
      providerId: 'credential',
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    });
    logger.info({ accountId: inserted.insertedId.toString() }, 'inserted new credential account');
  }
}

async function verifyLogin(spec: CredentialSpec): Promise<void> {
  const auth = getAuth();
  const result = await auth.api.signInEmail({
    body: {
      email: spec.email,
      password: spec.password,
    },
  });

  if (!result || !result.user) {
    throw new Error(`Sign in failed for ${spec.email}`);
  }

  logger.info(
    {
      email: result.user.email,
      role: (result.user as Record<string, unknown>).role,
      sessionToken: result.token ? 'issued' : 'missing',
    },
    'sign in test passed successfully',
  );
}

async function run(): Promise<void> {
  await connectDatabase();
  initAuth();

  for (const cred of CREDENTIALS) {
    await configureAccount(cred);
    await verifyLogin(cred);
  }

  // Update backend/.env
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    envContent = envContent.replace(
      /BOOTSTRAP_ADMIN_EMAIL=.*/g,
      'BOOTSTRAP_ADMIN_EMAIL=harshidsoni01@gmail.com',
    );
    envContent = envContent.replace(
      /BOOTSTRAP_ADMIN_PASSWORD=.*/g,
      'BOOTSTRAP_ADMIN_PASSWORD=Harshid@123',
    );
    fs.writeFileSync(envPath, envContent, 'utf8');
    logger.info('.env file updated with permanent admin credentials');
  }

  await disconnectDatabase();

  console.log('\n======================================================================');
  console.log('PERMANENT ADMIN & STAFF CREDENTIALS CONFIGURED AND VERIFIED');
  console.log('======================================================================');
  console.log('ADMIN:');
  console.log('  Username / Email: harshidsoni01@gmail.com');
  console.log('  Password:         Harshid@123');
  console.log('  Role:             admin');
  console.log('  Access:           Full firm administration and all practice areas');
  console.log('----------------------------------------------------------------------');
  console.log('STAFF:');
  console.log('  Username / Email: staff@gmail.com');
  console.log('  Password:         Staff@123');
  console.log('  Role:             staff');
  console.log('  Access:           Practice operations, client records, filings, tasks');
  console.log('======================================================================\n');
}

run().catch((err) => {
  logger.fatal({ err }, 'failed to configure permanent credentials');
  process.exitCode = 1;
});
