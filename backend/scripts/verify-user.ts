import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { logger } from '../src/config/logger.js';
import { User } from '../src/models/user.model.js';
import type { Role } from '../src/lib/enums.js';

async function run(): Promise<void> {
  const emailArg = process.argv[2];
  const roleArg = process.argv[3] as Role | undefined;

  if (!emailArg) {
    logger.error('Usage: npm run verify-user -- <email> [admin|staff|client]');
    process.exitCode = 1;
    return;
  }

  await connectDatabase();
  const email = emailArg.trim().toLowerCase();
  const updateData: Record<string, unknown> = {
    emailVerified: true,
    status: 'active',
  };
  if (roleArg !== undefined) {
    updateData.role = roleArg;
  }

  const result = await User.updateOne({ email }, { $set: updateData }).exec();
  if (result.matchedCount === 0) {
    logger.error({ email }, 'User not found in database');
    process.exitCode = 1;
  } else {
    const updated = await User.findOne({ email }).lean().exec();
    logger.info(
      {
        id: updated?._id,
        email: updated?.email,
        name: updated?.name,
        role: updated?.role,
        status: updated?.status,
        emailVerified: updated?.emailVerified,
      },
      'User verified successfully',
    );
  }

  await disconnectDatabase();
}

run().catch((err: unknown) => {
  logger.fatal({ err }, 'Script execution failed');
  process.exitCode = 1;
});
