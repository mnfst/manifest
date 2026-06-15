// Force the derivation KDF down to scrypt N=2 so we can exercise the key-cache
// eviction path (1024+ distinct salts) without paying full-cost scrypt per call.
jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return {
    ...actual,
    scryptSync: (secret: string, salt: Buffer | string, keylen: number) =>
      actual.scryptSync(secret, salt, keylen, { N: 2, r: 1, p: 1 }),
  };
});

import { encrypt, decrypt } from './crypto.util';

describe('crypto.util key cache eviction', () => {
  const SECRET = 'secret-key-at-least-32-characters-long!!';

  it('evicts the oldest entry once the cache exceeds its bound', () => {
    // Each encrypt uses a fresh random salt → a distinct cache key → the cache
    // grows past KEY_CACHE_MAX (1024) and the LRU eviction branch runs.
    let last = '';
    for (let i = 0; i < 1100; i++) {
      last = encrypt(`message-${i}`, SECRET);
    }
    expect(decrypt(last, SECRET)).toBe('message-1099');
  });
});
