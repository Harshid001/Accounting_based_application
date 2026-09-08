// ---------------------------------------------------------------------------
// Session Vault — encrypted Playwright storageState per client + portal
//
// Uses the existing AES-256-GCM crypto lib. Passwords are NEVER stored —
// only session cookies (storageState JSON) are encrypted and persisted.
// ---------------------------------------------------------------------------

import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';
import { encryptField, decryptField } from '../../lib/crypto.js';
import type { EncryptedField } from '../../lib/crypto.js';
import { PortalSession } from '../../models/portalSession.model.js';
import type { PortalKey } from '../../lib/enums.js';
import type { Types } from 'mongoose';

/** Default session TTL: 12 hours */
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;

const encryptionKey = (): string => {
  const key = env.FIELD_ENCRYPTION_KEY;
  if (!key) throw new Error('FIELD_ENCRYPTION_KEY is required for session vault');
  return key;
};

const encryptionKeyVersion = (): number => {
  return Number(env.FIELD_ENCRYPTION_KEY_VERSION) || 1;
};

/**
 * Save Playwright storageState (JSON string) encrypted at rest.
 * Upserts per client+portal — only one active session per combo.
 */
export const saveSessionState = async (
  clientId: Types.ObjectId,
  portal: PortalKey,
  storageStateJson: string,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<void> => {
  const encrypted: EncryptedField = encryptField(
    storageStateJson,
    encryptionKey(),
    encryptionKeyVersion(),
  );

  await PortalSession.findOneAndUpdate(
    { client: clientId, portal },
    {
      $set: {
        encryptedState: encrypted,
        expiresAt: new Date(Date.now() + ttlMs),
        lastUsedAt: new Date(),
      },
    },
    { upsert: true },
  ).exec();

  logger.debug(
    { event: 'session_vault.saved', clientId: clientId.toString(), portal },
    'portal session state encrypted and saved',
  );
};

/**
 * Restore a previously saved storageState for a client+portal.
 * Returns the decrypted JSON string, or null if no valid session exists.
 */
export const restoreSessionState = async (
  clientId: Types.ObjectId,
  portal: PortalKey,
): Promise<string | null> => {
  const session = await PortalSession.findOne({
    client: clientId,
    portal,
    expiresAt: { $gt: new Date() },
  }).exec();

  if (!session) return null;

  try {
    const decrypted = decryptField(session.encryptedState, encryptionKey());

    // Touch lastUsedAt
    session.lastUsedAt = new Date();
    await session.save();

    logger.debug(
      { event: 'session_vault.restored', clientId: clientId.toString(), portal },
      'portal session state restored',
    );

    return decrypted;
  } catch (error) {
    logger.warn(
      {
        event: 'session_vault.decrypt_failed',
        clientId: clientId.toString(),
        portal,
        err: error,
      },
      'failed to decrypt stored session state — it will be purged',
    );
    await session.deleteOne();
    return null;
  }
};

/**
 * Revoke (delete) a stored session for a client+portal.
 */
export const revokeSession = async (
  clientId: Types.ObjectId,
  portal: PortalKey,
): Promise<boolean> => {
  const result = await PortalSession.deleteOne({ client: clientId, portal }).exec();
  if (result.deletedCount > 0) {
    logger.info(
      { event: 'session_vault.revoked', clientId: clientId.toString(), portal },
      'portal session revoked',
    );
    return true;
  }
  return false;
};

/**
 * Revoke all sessions for a client (e.g. when archiving a client).
 */
export const revokeAllClientSessions = async (clientId: Types.ObjectId): Promise<number> => {
  const result = await PortalSession.deleteMany({ client: clientId }).exec();
  return result.deletedCount;
};
