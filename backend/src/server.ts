import type { Server } from 'node:http';

import { createApp } from './app.js';
import { initAuth } from './config/auth.js';
import { connectDatabase, disconnectDatabase, mongoose } from './config/db.js';
import { env, isProduction } from './config/env.js';
import { closeStorage } from './config/fileStorage.js';
import { logger } from './config/logger.js';
import { verifyMailTransport } from './config/mailer.js';
import { startScheduler, stopScheduler } from './jobs/index.js';
import { seedComplianceTypes } from './seed/complianceTypes.seed.js';
import { bootstrapAdmin } from './seed/bootstrapAdmin.seed.js';

const REQUIRED_INDEX_HINT =
  'Indexes are not built automatically in production. Run `npm run indexes` after deploying.';

let server: Server | null = null;
let shuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ event: 'shutdown.begin', signal }, 'shutting down');

  await stopScheduler();
  if (server) {
    await new Promise<void>((resolve) => {
      server?.close(() => {
        resolve();
      });
    });
  }
  closeStorage();
  await disconnectDatabase();
  logger.info({ event: 'shutdown.complete' }, 'shutdown complete');
  process.exit(0);
};

const start = async (): Promise<void> => {
  await connectDatabase();
  initAuth();

  if (isProduction) {
    logger.info({ event: 'indexes.manual' }, REQUIRED_INDEX_HINT);
  } else {
    await mongoose.syncIndexes().catch((error: unknown) => {
      logger.warn({ event: 'indexes.sync_failed', err: error }, 'index sync failed');
    });
  }

  await seedComplianceTypes();
  await bootstrapAdmin();
  await verifyMailTransport();

  const app = createApp();
  server = app.listen(env.PORT, () => {
    logger.info(
      { event: 'server.listening', port: env.PORT, env: env.NODE_ENV },
      'FirmDesk API is listening',
    );
  });

  startScheduler();

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('unhandledRejection', (reason) => {
    logger.error({ event: 'unhandled_rejection', err: reason }, 'unhandled promise rejection');
  });
  process.on('uncaughtException', (error) => {
    logger.fatal({ event: 'uncaught_exception', err: error }, 'uncaught exception, exiting');
    void shutdown('uncaughtException');
  });
};

start().catch((error: unknown) => {
  logger.fatal({ event: 'startup.failed', err: error }, 'FirmDesk API could not start');
  process.exit(1);
});
