import { hashKey, keyPrefix } from './hash.util';

describe('hashKey', () => {
  it('returns a hex string', () => {
    const hash = hashKey('test-key');
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('returns consistent output for same input', () => {
    expect(hashKey('my-key')).toBe(hashKey('my-key'));
  });

  it('returns different output for different input', () => {
    expect(hashKey('key-1')).not.toBe(hashKey('key-2'));
  });

  it('returns 64 hex chars (32 bytes)', () => {
    expect(hashKey('any-input')).toHaveLength(64);
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
