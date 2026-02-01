import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * SECURITY: Encryption utilities for secrets at rest
 * Uses AES-256-GCM with a key derived from BETTER_AUTH_SECRET
 */
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT = 'manifest-secrets-v1'; // Static salt for key derivation

function getEncryptionKey(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    // In development without secret, use a deterministic key (not secure for production)
    return scryptSync('dev-insecure-key', SALT, 32);
  }
  return scryptSync(secret, SALT, 32);
}

export function encryptValue(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encryptedData (all hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptValue(encryptedValue: string): string {
  // Check if value is encrypted (contains colons for iv:authTag:data format)
  if (!encryptedValue.includes(':')) {
    // Legacy unencrypted value - return as-is
    return encryptedValue;
  }

  const parts = encryptedValue.split(':');
  if (parts.length !== 3) {
    // Invalid format - return as-is (might be unencrypted value with colon)
    return encryptedValue;
  }

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    // Decryption failed - might be legacy unencrypted value
    return encryptedValue;
  }
}
