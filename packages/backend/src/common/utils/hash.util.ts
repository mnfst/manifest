import { scryptSync } from 'crypto';

const HASH_SALT = 'manifest-api-key-salt';
const KEY_LENGTH = 32;

export function sha256(input: string): string {
  return scryptSync(input, HASH_SALT, KEY_LENGTH).toString('hex');
}

export function keyPrefix(key: string): string {
  return key.substring(0, 12);
}
