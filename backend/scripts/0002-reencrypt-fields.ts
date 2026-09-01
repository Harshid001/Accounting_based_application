import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { logger } from '../src/config/logger.js';
import { decryptField, encryptField } from '../src/lib/crypto.js';
import { Client } from '../src/models/client.model.js';

const run = async (): Promise<void> => {
  const previousKey = env.FIELD_ENCRYPTION_KEY_PREVIOUS;
  if (previousKey === undefined) {
    logger.error(
      { event: 'reencrypt.no_previous_key' },
      'set FIELD_ENCRYPTION_KEY_PREVIOUS to the retiring key and FIELD_ENCRYPTION_KEY to the new one, then run again',
    );
    process.exitCode = 1;
    return;
  }

  await connectDatabase();

  const cursor = Client.find({ aadhaarEncrypted: { $ne: null } })
    .select('+aadhaarEncrypted')
    .cursor();

  let migrated = 0;
  let alreadyCurrent = 0;
  let failed = 0;

  for await (const doc of cursor) {
    const held = doc.aadhaarEncrypted;
    if (!held) continue;
    if (held.keyVersion === env.FIELD_ENCRYPTION_KEY_VERSION) {
      alreadyCurrent += 1;
      continue;
    }
    try {
      const plaintext = decryptField(held, previousKey);
      doc.set(
        'aadhaarEncrypted',
        encryptField(plaintext, env.FIELD_ENCRYPTION_KEY, env.FIELD_ENCRYPTION_KEY_VERSION),
      );
      await doc.save();
      migrated += 1;
    } catch {
      failed += 1;
      logger.error(
        { event: 'reencrypt.record_failed', clientId: doc._id.toString() },
        'a record could not be re-encrypted with the previous key',
      );
    }
  }

  logger.info(
    { event: 'reencrypt.complete', migrated, alreadyCurrent, failed },
    're-encryption pass finished',
  );
  if (failed > 0) process.exitCode = 1;
  await disconnectDatabase();
};

run().catch((error: unknown) => {
  logger.fatal({ event: 'reencrypt.failed', err: error }, 're-encryption pass failed');
  process.exitCode = 1;
});
