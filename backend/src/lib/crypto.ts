import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface EncryptedField {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
}

export class FieldDecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FieldDecryptionError';
  }
}

const toKey = (base64Key: string): Buffer => {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) {
    throw new FieldDecryptionError('Field encryption key must decode to exactly 32 bytes.');
  }
  return key;
};

export const encryptField = (
  plaintext: string,
  base64Key: string,
  keyVersion: number,
): EncryptedField => {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, toKey(base64Key), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    keyVersion,
  };
};

export const decryptField = (field: EncryptedField, base64Key: string): string => {
  const iv = Buffer.from(field.iv, 'base64');
  const tag = Buffer.from(field.tag, 'base64');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new FieldDecryptionError('Stored ciphertext is malformed.');
  }
  const decipher = createDecipheriv(ALGORITHM, toKey(base64Key), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([
      decipher.update(Buffer.from(field.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new FieldDecryptionError('Stored ciphertext failed authentication and was rejected.');
  }
};

export const randomStorageKey = (prefix: string, extension: string): string => {
  const safeExtension = extension.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const random = randomBytes(24).toString('base64url');
  const suffix = safeExtension.length > 0 ? `.${safeExtension}` : '';
  return `${prefix}/${random}${suffix}`;
};

export const constantTimeEquals = (a: string, b: string): boolean => {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
};
