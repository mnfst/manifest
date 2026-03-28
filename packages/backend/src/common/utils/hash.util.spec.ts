import { hashKey, keyPrefix, verifyKey } from './hash.util';

describe('hashKey', () => {
  it('returns salt:hash format', () => {
    const hash = hashKey('test-key');
    expect(hash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });

  it('returns different output for each call (random salt)', () => {
    expect(hashKey('my-key')).not.toBe(hashKey('my-key'));
  });

  it('returns different output for different input', () => {
    expect(hashKey('key-1')).not.toBe(hashKey('key-2'));
  });

  it('returns salt_hex:hash_hex with correct lengths', () => {
    const hash = hashKey('any-input');
    const [salt, h] = hash.split(':');
    expect(salt).toHaveLength(32); // 16 bytes = 32 hex chars
    expect(h).toHaveLength(64); // 32 bytes = 64 hex chars
  });
});

describe('verifyKey', () => {
  it('verifies a key against its hash', () => {
    const hash = hashKey('my-secret-key');
    expect(verifyKey('my-secret-key', hash)).toBe(true);
  });

  it('rejects wrong key', () => {
    const hash = hashKey('my-secret-key');
    expect(verifyKey('wrong-key', hash)).toBe(false);
  });

  it('verifies legacy format (64-char hex without colon)', () => {
    // Legacy format: scrypt with static salt 'manifest-api-key-salt'
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { scryptSync: scryptLegacy } = require('crypto');
    const legacyHash = scryptLegacy('legacy-key', 'manifest-api-key-salt', 32).toString('hex');
    expect(legacyHash).toHaveLength(64);
    expect(legacyHash).not.toContain(':');
    expect(verifyKey('legacy-key', legacyHash)).toBe(true);
    expect(verifyKey('wrong-key', legacyHash)).toBe(false);
  });
});

describe('keyPrefix', () => {
  it('returns first 12 characters', () => {
    expect(keyPrefix('mnfst_abcdefghij')).toBe('mnfst_abcdef');
  });

  it('returns full string when shorter than 12 chars', () => {
    expect(keyPrefix('short')).toBe('short');
  });
});
