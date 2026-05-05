import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from 'crypto';
import { Logger as NestLogger } from '@nestjs/common';

const ALGORITHM = 'aes-256-gcm';
// AES-GCM standard nonce length per NIST SP 800-38D §5.2.1.1. New ciphertexts
// use 12 bytes; legacy 16-byte IVs from older versions still decrypt fine.
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

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
  // Index the cache by HMAC(secret, salt) so the raw secret never lives as a
  // Map key string. A heap dump of the Node.js process previously exposed
  // the encryption secret directly via the cache key; HMAC removes that path.
  const cacheKey = createHmac('sha256', secret).update(salt).digest('hex');
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
