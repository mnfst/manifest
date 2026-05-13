import { createHash } from 'crypto';
import { generatePkce, generateState } from './pkce';

describe('pkce', () => {
  describe('generatePkce', () => {
    it('returns a base64url verifier and a S256 challenge derived from it', () => {
      const { verifier, challenge } = generatePkce();
      // base64url alphabet: A-Z a-z 0-9 - _
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
      const expected = createHash('sha256').update(verifier).digest('base64url');
      expect(challenge).toBe(expected);
    });

    it('produces a fresh pair on every call', () => {
      const a = generatePkce();
      const b = generatePkce();
      expect(a.verifier).not.toBe(b.verifier);
      expect(a.challenge).not.toBe(b.challenge);
    });
  });

  describe('generateState', () => {
    it('returns a hex string of the requested byte length', () => {
      expect(generateState(8)).toMatch(/^[0-9a-f]{16}$/);
      expect(generateState()).toMatch(/^[0-9a-f]{64}$/); // default 32 bytes
    });

    it('produces a fresh value on every call', () => {
      expect(generateState()).not.toBe(generateState());
    });
  });
});
