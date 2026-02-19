import { sha256, keyPrefix } from './hash.util';

describe('hash.util', () => {
  describe('sha256', () => {
    it('returns a 64-character hex string', () => {
      const result = sha256('test-input');
      expect(result).toHaveLength(64);
      expect(result).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces deterministic output', () => {
      expect(sha256('hello')).toBe(sha256('hello'));
    });

    it('produces different output for different inputs', () => {
      expect(sha256('input-a')).not.toBe(sha256('input-b'));
    });

    it('matches known SHA-256 digest', () => {
      // echo -n "abc" | sha256sum
      expect(sha256('abc')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });
  });

  describe('keyPrefix', () => {
    it('returns the first 12 characters', () => {
      expect(keyPrefix('mnfst_abcdefghijklmnop')).toBe('mnfst_abcdef');
    });

    it('returns the full string if shorter than 12 chars', () => {
      expect(keyPrefix('short')).toBe('short');
    });

    it('returns exactly 12 characters for long keys', () => {
      const result = keyPrefix('a'.repeat(100));
      expect(result).toHaveLength(12);
    });
  });
});
