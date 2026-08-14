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

    it('verifier is exactly 43 base64url chars (no padding) — 32 bytes of entropy', () => {
      // 32 bytes encoded as base64url = ceil(32 * 4 / 3) = 43 chars (no '=' padding).
      // This pins the entropy floor at 256 bits and rejects any future
      // `randomBytes(n)` change where n < 32.
      const { verifier } = generatePkce();
      expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(verifier).not.toContain('=');
    });

    it('verifier base64url-decodes to exactly 32 bytes (256 bits of entropy)', () => {
      const { verifier } = generatePkce();
      const decoded = Buffer.from(verifier, 'base64url');
      expect(decoded.length).toBe(32);
    });

    it('challenge is exactly 43 base64url chars (no padding) — SHA-256 output', () => {
      // SHA-256 emits 32 bytes → 43 base64url chars, identical shape to the verifier.
      const { challenge } = generatePkce();
      expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(challenge).not.toContain('=');
    });

    it('challenge base64url-decodes to exactly 32 bytes (SHA-256 digest size)', () => {
      const { challenge } = generatePkce();
      const decoded = Buffer.from(challenge, 'base64url');
      expect(decoded.length).toBe(32);
    });

    it('verifier and challenge contain no base64 (non-url) characters "+" or "/"', () => {
      // Defends against regressions that switch encoding to base64 (which uses + and /
      // instead of - and _, and adds = padding) — illegal in RFC 7636 §4.1.
      const { verifier, challenge } = generatePkce();
      expect(verifier).not.toMatch(/[+/=]/);
      expect(challenge).not.toMatch(/[+/=]/);
    });

    it('verifiers are unique across many invocations (entropy smoke test)', () => {
      // Hardcoded sample size: with 256 bits of entropy a collision is astronomically
      // unlikely; this still catches a regression where someone wires up a stub.
      const sampleSize = 64;
      const seen = new Set<string>();
      for (let i = 0; i < sampleSize; i += 1) {
        seen.add(generatePkce().verifier);
      }
      expect(seen.size).toBe(sampleSize);
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
