import { createHash } from 'crypto';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function keyPrefix(key: string): string {
  return key.substring(0, 12);
}
