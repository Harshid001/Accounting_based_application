import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { hashPassword, verifyPassword } from 'better-auth/crypto';

import { connectDatabase, disconnectDatabase, getDb } from '../src/config/db.js';
import { logger } from '../src/config/logger.js';
import { checkPassword } from '../src/lib/passwordPolicy.js';
import { User } from '../src/models/user.model.js';

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  const bytes = crypto.randomBytes(12);
  let randomPart = '';
  for (let i = 0; i < 12; i += 1) {
    const byte = bytes[i];
    if (byte !== undefined) {
      randomPart += chars[byte % chars.length];
    }
  }
  return `FirmDesk!2026#${randomPart}`;
}

async function run(): Promise<void> {
  const targetEmail = (process.argv[2] ?? 'harshidsoni08@gmail.com').trim().toLowerCase();
  const password = process.argv[3] ?? generateSecurePassword();

  logger.info({ email: targetEmail }, 'setting secure admin credentials');

  await connectDatabase();
  const db = getDb();

  let user = await User.findOne({ email: targetEmail }).exec();

  const name = user?.name ?? 'Practice Admin';
  const policy = checkPassword(password, [targetEmail, name]);
  if (!policy.ok) {
    logger.error({ reason: policy.message }, 'password failed policy checks');
    process.exitCode = 1;
    await disconnectDatabase();
    return;
  }

  const hashedPassword = await hashPassword(password);
  const isValid = await verifyPassword({ hash: hashedPassword, password });
  if (!isValid) {
    logger.error('internal error: generated password hash could not be verified');
    process.exitCode = 1;
    await disconnectDatabase();
    return;
  }

  const now = new Date();

  if (!user) {
    user = await User.create({
      email: targetEmail,
      name,
      role: 'admin',
      status: 'active',
      emailVerified: true,
      linkedClients: [],
      pinnedClients: [],
      createdAt: now,
      updatedAt: now,
    });
    logger.info({ email: targetEmail, id: user._id.toString() }, 'created new admin user document');
  } else {
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          role: 'admin',
          status: 'active',
          emailVerified: true,
          updatedAt: now,
        },
      },
    ).exec();
    logger.info({ email: targetEmail, id: user._id.toString() }, 'updated user to active verified admin');
  }

  // Update or insert into Better Auth's account collection
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
    logger.info({ accountId: existingAccount._id.toString() }, 'updated existing credential account with new password hash');
  } else {
    const newAccount = await db.collection('account').insertOne({
      userId: user._id,
      accountId: user._id.toString(),
      providerId: 'credential',
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    });
    logger.info({ accountId: newAccount.insertedId.toString() }, 'inserted new credential account for user');
  }

  // Update backend/.env with BOOTSTRAP_ADMIN_PASSWORD if file exists
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('BOOTSTRAP_ADMIN_PASSWORD=')) {
      envContent = envContent.replace(
        /BOOTSTRAP_ADMIN_PASSWORD=.*/g,
        `BOOTSTRAP_ADMIN_PASSWORD=${password}`,
      );
    } else {
      envContent += `\nBOOTSTRAP_ADMIN_PASSWORD=${password}\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
    logger.info('.env file updated with BOOTSTRAP_ADMIN_PASSWORD');
  }

  await disconnectDatabase();

  console.log('\n======================================================');
  console.log('SINGLE ADMIN & STAFF LOGIN CREDENTIALS CONFIGURED');
  console.log('======================================================');
  console.log(`Portal:    Staff & Admin Console (/dashboard)`);
  console.log(`Email:     ${targetEmail}`);
  console.log(`Password:  ${password}`);
  console.log(`Role:      admin (full firm-wide permissions)`);
  console.log(`Status:    active (email verified)`);
  console.log('======================================================\n');
}

run().catch((err: unknown) => {
  logger.fatal({ err }, 'failed to set admin credentials');
  process.exitCode = 1;
});
