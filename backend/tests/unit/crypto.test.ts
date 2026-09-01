import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  FieldDecryptionError,
  constantTimeEquals,
  decryptField,
  encryptField,
  randomStorageKey,
} from '../../src/lib/crypto.js';

const key = randomBytes(32).toString('base64');
const otherKey = randomBytes(32).toString('base64');

describe('field encryption', () => {
  it('round-trips a value', () => {
    const encrypted = encryptField('123456789012', key, 1);
    expect(decryptField(encrypted, key)).toBe('123456789012');
  });

  it('records the key version it used', () => {
    expect(encryptField('123456789012', key, 4).keyVersion).toBe(4);
  });

  it('produces a different ciphertext each time for the same input', () => {
    const first = encryptField('123456789012', key, 1);
    const second = encryptField('123456789012', key, 1);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(first.iv).not.toBe(second.iv);
  });

  it('rejects a tampered authentication tag', () => {
    const encrypted = encryptField('123456789012', key, 1);
    const tampered = { ...encrypted, tag: randomBytes(16).toString('base64') };
    expect(() => decryptField(tampered, key)).toThrow(FieldDecryptionError);
  });

  it('rejects tampered ciphertext', () => {
    const encrypted = encryptField('123456789012', key, 1);
    const bytes = Buffer.from(encrypted.ciphertext, 'base64');
    bytes[0] = (bytes[0] ?? 0) ^ 0xff;
    const tampered = { ...encrypted, ciphertext: bytes.toString('base64') };
    expect(() => decryptField(tampered, key)).toThrow(FieldDecryptionError);
  });

  it('rejects the wrong key', () => {
    const encrypted = encryptField('123456789012', key, 1);
    expect(() => decryptField(encrypted, otherKey)).toThrow(FieldDecryptionError);
  });

  it('rejects a malformed iv', () => {
    const encrypted = encryptField('123456789012', key, 1);
    expect(() => decryptField({ ...encrypted, iv: 'AAAA' }, key)).toThrow(FieldDecryptionError);
  });

  it('rejects a key that is not 32 bytes', () => {
    expect(() => encryptField('123456789012', randomBytes(16).toString('base64'), 1)).toThrow(
      FieldDecryptionError,
    );
  });
});

describe('storage keys', () => {
  it('never contains the original filename', () => {
    const storageKey = randomStorageKey('clients/abc', 'pdf');
    expect(storageKey).not.toContain('statement');
    expect(storageKey.startsWith('clients/abc/')).toBe(true);
    expect(storageKey.endsWith('.pdf')).toBe(true);
  });

  it('strips anything that is not alphanumeric from the extension', () => {
    expect(randomStorageKey('clients/abc', '../../etc/passwd')).not.toContain('..');
  });

  it('produces a distinct key every time', () => {
    const keys = new Set(
      Array.from({ length: 50 }, () => randomStorageKey('clients/abc', 'pdf')),
    );
    expect(keys.size).toBe(50);
  });
});

describe('constant time comparison', () => {
  it('matches identical strings', () => {
    expect(constantTimeEquals('abcdef', 'abcdef')).toBe(true);
  });

  it('rejects different strings and different lengths', () => {
    expect(constantTimeEquals('abcdef', 'abcdeg')).toBe(false);
    expect(constantTimeEquals('abc', 'abcdef')).toBe(false);
  });
});
