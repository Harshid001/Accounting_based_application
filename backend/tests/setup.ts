import { randomBytes } from 'node:crypto';

import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll } from 'vitest';

const memory = await MongoMemoryServer.create();

process.env.NODE_ENV = 'test';
process.env.PORT = '4999';
process.env.LOG_LEVEL = 'silent';
process.env.MONGODB_URI = memory.getUri('firmdesk_test');
process.env.APP_BASE_URL = 'http://localhost:5173';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('hex');
process.env.BETTER_AUTH_URL = 'http://localhost:4999';
process.env.SESSION_COOKIE_SAMESITE = 'lax';
process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.FIELD_ENCRYPTION_KEY_VERSION = '1';
process.env.SMTP_HOST = 'smtp.test.invalid';
process.env.SMTP_PORT = '587';
process.env.MAIL_FROM = 'FirmDesk <firmdesk@test.invalid>';
process.env.SCHEDULER_ENABLED = 'false';
process.env.SCHEDULER_TIMEZONE = 'Asia/Kolkata';
process.env.COMPLIANCE_HORIZON_DAYS = '120';
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
delete process.env.BOOTSTRAP_ADMIN_EMAIL;

const { connectDatabase, disconnectDatabase, mongoose } = await import('../src/config/db.js');
const { initAuth, resetAuthForTests } = await import('../src/config/auth.js');
const { resetRateLimits } = await import('../src/middleware/rateLimit.js');

beforeAll(async () => {
  await connectDatabase();
  await mongoose.connection.db?.dropDatabase();
  await import('../src/routes/index.js');
  await mongoose.syncIndexes();
  initAuth();
});

afterEach(async () => {
  await resetRateLimits();
  const db = mongoose.connection.db;
  if (!db) return;
  const collections = await db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  resetAuthForTests();
  await disconnectDatabase();
  await memory.stop();
});
