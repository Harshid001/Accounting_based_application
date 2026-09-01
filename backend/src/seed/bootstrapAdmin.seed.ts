import { getAuth } from '../config/auth.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { checkPassword } from '../lib/passwordPolicy.js';
import { User } from '../models/user.model.js';

export const bootstrapAdmin = async (): Promise<{ created: boolean }> => {
  const email = env.BOOTSTRAP_ADMIN_EMAIL;
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = env.BOOTSTRAP_ADMIN_NAME;

  if (email === undefined || email === '' || password === undefined || name === undefined) {
    return { created: false };
  }

  const anyAdmin = await User.findOne({ role: 'admin' }).select('_id').lean().exec();
  if (anyAdmin) return { created: false };

  const verdict = checkPassword(password, [email, name]);
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
    logger.error({ event: 'bootstrap.failed', err: error }, 'the first admin could not be created');
    return { created: false };
  }

  const result = await User.updateOne(
    { email: email.toLowerCase() },
    { $set: { role: 'admin', status: 'active', emailVerified: true, linkedClients: [] } },
  ).exec();

  if (result.modifiedCount === 0 && result.matchedCount === 0) {
    logger.error({ event: 'bootstrap.missing' }, 'the bootstrap account vanished after creation');
    return { created: false };
  }

  logger.info(
    { event: 'bootstrap.created' },
    'the first administrator was created from environment values; change that password now',
  );
  return { created: true };
};
