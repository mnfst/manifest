import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

/** @deprecated Static salt used by legacy hashes — only for backward-compat verification. */
const LEGACY_SALT = 'manifest-api-key-salt';
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

/**
 * Hash an API key with a per-key random salt.
 * Returns `salt_hex:hash_hex` format.
 */
export function hashKey(input: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const hash = scryptSync(input, salt, KEY_LENGTH);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/**
 * Verify an API key against a stored hash.
 * Supports both new `salt_hex:hash_hex` format and legacy 64-char hex format.
 */
export function verifyKey(input: string, storedHash: string): boolean {
  if (storedHash.includes(':')) {
    const [saltHex, hashHex] = storedHash.split(':');
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(input, salt, KEY_LENGTH);
    return timingSafeEqual(actual, expected);
  }
  // Legacy: static salt, 64-char hex hash
  const legacyHash = scryptSync(input, LEGACY_SALT, KEY_LENGTH).toString('hex');
  return legacyHash === storedHash;
}

export function keyPrefix(key: string): string {
  return key.substring(0, 12);
}
