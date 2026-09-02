import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { Logger as NestLogger } from '@nestjs/common';

const ALGORITHM = 'aes-256-gcm';
// AES-GCM standard nonce length per NIST SP 800-38D §5.2.1.1. New ciphertexts
// use 12 bytes; legacy 16-byte IVs from older versions still decrypt fine.
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
// Cheap scrypt fingerprint for cache indexing only — N=2 keeps it ~10µs while
// remaining the same approved KDF family as the actual derivation below.
const FINGERPRINT_LENGTH = 16;
const FINGERPRINT_SCRYPT_OPTS = { N: 2, r: 1, p: 1 } as const;

const logger = new NestLogger('crypto.util');
let warnedAboutSecretReuse = false;

// scrypt is deliberately CPU-expensive (~50ms+ per derivation with default
// params). Calling it on every encrypt/decrypt — which happens on the proxy
// hot path for provider keys — turns into a meaningful DoS amplifier under
// load. Cache the derived key per (secret, salt) pair: AES-GCM with random
// IVs remains safe (the (key, IV) pair is unique per ciphertext).
const keyCache = new Map<string, Buffer>();
const KEY_CACHE_MAX = 1024;

function deriveKey(secret: string, salt: Buffer): Buffer {
  // Index the cache by a cheap scrypt-based fingerprint of (secret, salt) so
  // the raw secret never lives as a Map key string. A heap dump of the Node.js
  // process previously exposed the encryption secret directly via the cache
  // key; the fingerprint removes that path. We deliberately use scrypt (the
  // same approved KDF family as the actual key derivation below) at minimal
  // cost — this is purely a cache index, not the security-critical KDF.
  const cacheKey = scryptSync(secret, salt, FINGERPRINT_LENGTH, FINGERPRINT_SCRYPT_OPTS).toString(
    'base64',
  );
  const cached = keyCache.get(cacheKey);
  if (cached) return cached;
  const derived = scryptSync(secret, salt, KEY_LENGTH);
  if (keyCache.size >= KEY_CACHE_MAX) {
    const firstKey = keyCache.keys().next().value;
    if (firstKey) keyCache.delete(firstKey);
  }
  keyCache.set(cacheKey, derived);
  return derived;
}

export function getEncryptionSecret(): string {
  const dedicated = process.env['MANIFEST_ENCRYPTION_KEY'];
  if (dedicated && dedicated.length >= 32) {
    return dedicated;
  }

  // Falling back to BETTER_AUTH_SECRET means a single secret leak compromises
  // both session signing and stored provider/OAuth keys. Warn once at boot so
  // operators have a clear remediation path: set MANIFEST_ENCRYPTION_KEY to a
  // separate 32+ char secret.
  const sessionSecret = process.env['BETTER_AUTH_SECRET'];
  if (sessionSecret && sessionSecret.length >= 32) {
    if (!warnedAboutSecretReuse && process.env['NODE_ENV'] === 'production') {
      warnedAboutSecretReuse = true;
      logger.warn(
        'MANIFEST_ENCRYPTION_KEY not set — falling back to BETTER_AUTH_SECRET for at-rest ' +
          'encryption. Set MANIFEST_ENCRYPTION_KEY to a separate 32+ char secret so a session-' +
          'signing leak does not also decrypt stored provider/OAuth keys.',
      );
    }
    return sessionSecret;
  }

  throw new Error(
    'Encryption secret required. Set MANIFEST_ENCRYPTION_KEY or BETTER_AUTH_SECRET (>=32 chars).',
  );
}

/**
 * Every secret that may have encrypted a stored value, newest first.
 *
 * The first entry is always what {@link getEncryptionSecret} returns, so a
 * `secretIndex` of 0 from {@link decryptWithAny} means "already under the
 * current key" and anything greater means "written under an older key and due
 * for a rewrite".
 *
 * Order: the dedicated key, then MANIFEST_ENCRYPTION_KEY_PREVIOUS (set during
 * a rotation), then BETTER_AUTH_SECRET. Keeping the session secret last is
 * what lets an operator introduce MANIFEST_ENCRYPTION_KEY on an install that
 * had been encrypting with the session secret: old ciphertext still decrypts
 * without any PREVIOUS value.
 */
export function getDecryptionSecrets(): string[] {
  // getEncryptionSecret() throws when nothing usable is configured — let that
  // propagate, it is the same failure the encrypt path already reports.
  const secrets: string[] = [getEncryptionSecret()];
  const add = (candidate: string | undefined): void => {
    if (candidate && candidate.length >= 32 && !secrets.includes(candidate)) {
      secrets.push(candidate);
    }
  };
  add(process.env['MANIFEST_ENCRYPTION_KEY_PREVIOUS']);
  add(process.env['BETTER_AUTH_SECRET']);
  return secrets;
}

export function encrypt(plaintext: string, secret: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(secret, salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    salt.toString('base64'),
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

export function decrypt(ciphertext: string, secret: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid ciphertext format');
  }
  const [saltB64, ivB64, tagB64, encryptedB64] = parts;
  const salt = Buffer.from(saltB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');
  const key = deriveKey(secret, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Decrypt with the first secret that works, reporting which one that was.
 *
 * `secretIndex > 0` means the value is still encrypted under an older secret;
 * the boot-time re-encryption pass uses that to decide what to rewrite. When
 * no secret works the last error is rethrown, so callers see a real
 * decryption failure rather than a generic one.
 */
export function decryptWithAny(
  ciphertext: string,
  secrets: string[],
): { plaintext: string; secretIndex: number } {
  if (secrets.length === 0) {
    throw new Error('No decryption secret available');
  }
  let lastError: unknown;
  for (let index = 0; index < secrets.length; index++) {
    try {
      return { plaintext: decrypt(ciphertext, secrets[index]), secretIndex: index };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  if (parts.length !== 4) return false;
  try {
    for (const part of parts) {
      const buf = Buffer.from(part, 'base64');
      if (buf.toString('base64') !== part) return false;
    }
    return true;
  } catch {
    return false;
  }
}
