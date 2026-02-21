import { sha256, keyPrefix } from './hash.util';

describe('sha256', () => {
  it('returns a hex string', () => {
    const hash = sha256('test-key');
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('returns consistent output for same input', () => {
    expect(sha256('my-key')).toBe(sha256('my-key'));
  });

  it('returns different output for different input', () => {
    expect(sha256('key-1')).not.toBe(sha256('key-2'));
  });

  it('returns 64 hex chars (32 bytes)', () => {
    expect(sha256('any-input')).toHaveLength(64);
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
