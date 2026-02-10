/**
 * Unit tests for user fingerprint generation
 *
 * Tests the SHA-256 hashing logic used to generate unique user fingerprints
 * from IP address and User-Agent strings. This logic is used in McpController
 * to track unique users for analytics.
 */

import * as crypto from 'crypto';
import { generateUserFingerprint as generateFromRequest } from './mcp.utils';

/**
 * Wrapper that accepts raw IP/User-Agent strings for easier testing.
 * The exported utility accepts a Request object, so we build a minimal mock.
 */
function generateUserFingerprint(
  ip: string | undefined,
  userAgent: string | undefined,
): string {
  const req = {
    ip: ip || undefined,
    socket: { remoteAddress: undefined },
    get: (header: string) => (header === 'user-agent' ? userAgent : undefined),
  } as Parameters<typeof generateFromRequest>[0];
  return generateFromRequest(req);
}

describe('User Fingerprint Generation', () => {
  describe('generateUserFingerprint', () => {
    it('should generate 16-character hex string', () => {
      const fingerprint = generateUserFingerprint('192.168.1.1', 'Mozilla/5.0');

      expect(fingerprint).toHaveLength(16);
      expect(/^[a-f0-9]+$/.test(fingerprint)).toBe(true);
    });

    it('should generate consistent fingerprint for same inputs', () => {
      const ip = '10.0.0.1';
      const userAgent = 'TestAgent/1.0';

      const fingerprint1 = generateUserFingerprint(ip, userAgent);
      const fingerprint2 = generateUserFingerprint(ip, userAgent);

      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should generate different fingerprints for different IPs', () => {
      const userAgent = 'SameAgent/1.0';

      const fingerprint1 = generateUserFingerprint('10.0.0.1', userAgent);
      const fingerprint2 = generateUserFingerprint('10.0.0.2', userAgent);

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should generate different fingerprints for different User-Agents', () => {
      const ip = '10.0.0.1';

      const fingerprint1 = generateUserFingerprint(ip, 'Chrome/100.0');
      const fingerprint2 = generateUserFingerprint(ip, 'Firefox/90.0');

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should handle undefined IP by using "unknown"', () => {
      const userAgent = 'TestAgent/1.0';

      const fingerprintUndefined = generateUserFingerprint(undefined, userAgent);
      const fingerprintUnknown = generateUserFingerprint('unknown', userAgent);

      expect(fingerprintUndefined).toBe(fingerprintUnknown);
    });

    it('should handle undefined User-Agent by using "unknown"', () => {
      const ip = '10.0.0.1';

      const fingerprintUndefined = generateUserFingerprint(ip, undefined);
      const fingerprintUnknown = generateUserFingerprint(ip, 'unknown');

      expect(fingerprintUndefined).toBe(fingerprintUnknown);
    });

    it('should handle both IP and User-Agent being undefined', () => {
      const fingerprint = generateUserFingerprint(undefined, undefined);

      expect(fingerprint).toHaveLength(16);
      // Should be the hash of "unknown:unknown"
      const expected = crypto
        .createHash('sha256')
        .update('unknown:unknown')
        .digest('hex')
        .substring(0, 16);
      expect(fingerprint).toBe(expected);
    });

    it('should handle empty string IP', () => {
      // Empty string is falsy so should use 'unknown'
      const fingerprintEmpty = generateUserFingerprint('', 'Agent/1.0');
      const fingerprintUnknown = generateUserFingerprint('unknown', 'Agent/1.0');

      expect(fingerprintEmpty).toBe(fingerprintUnknown);
    });

    it('should handle IPv6 addresses', () => {
      const ip = '::1';
      const userAgent = 'TestAgent/1.0';

      const fingerprint = generateUserFingerprint(ip, userAgent);

      expect(fingerprint).toHaveLength(16);
    });

    it('should handle long User-Agent strings', () => {
      const ip = '10.0.0.1';
      const longUserAgent =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0';

      const fingerprint = generateUserFingerprint(ip, longUserAgent);

      expect(fingerprint).toHaveLength(16);
    });

    it('should handle special characters in User-Agent', () => {
      const ip = '10.0.0.1';
      const userAgent = 'Agent/1.0 (compatible; Bot); http://example.com';

      const fingerprint = generateUserFingerprint(ip, userAgent);

      expect(fingerprint).toHaveLength(16);
    });

    it('should produce expected SHA-256 hash prefix', () => {
      // Verify the algorithm produces correct hash
      const ip = '192.168.1.100';
      const userAgent = 'Mozilla/5.0';

      const fingerprint = generateUserFingerprint(ip, userAgent);

      // Manually calculate expected value
      const fullHash = crypto
        .createHash('sha256')
        .update(`${ip}:${userAgent}`)
        .digest('hex');
      const expected = fullHash.substring(0, 16);

      expect(fingerprint).toBe(expected);
    });
  });

  describe('fingerprint uniqueness', () => {
    it('should generate unique fingerprints for 100 different IPs', () => {
      const fingerprints = new Set<string>();
      const userAgent = 'TestAgent/1.0';

      for (let i = 0; i < 100; i++) {
        const ip = `192.168.1.${i}`;
        fingerprints.add(generateUserFingerprint(ip, userAgent));
      }

      // All 100 fingerprints should be unique
      expect(fingerprints.size).toBe(100);
    });

    it('should generate unique fingerprints for different browser User-Agents', () => {
      const ip = '10.0.0.1';
      const browsers = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 Safari/17.2',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/120.0.0.0',
      ];

      const fingerprints = new Set(
        browsers.map((ua) => generateUserFingerprint(ip, ua)),
      );

      expect(fingerprints.size).toBe(browsers.length);
    });
  });

  describe('collision resistance', () => {
    it('should have low collision probability for similar inputs', () => {
      // Test that slight differences produce completely different fingerprints
      const base = generateUserFingerprint('192.168.1.100', 'Agent/1.0');
      const offByOneIp = generateUserFingerprint('192.168.1.101', 'Agent/1.0');
      const offByOneAgent = generateUserFingerprint('192.168.1.100', 'Agent/1.1');

      // They should all be different
      expect(base).not.toBe(offByOneIp);
      expect(base).not.toBe(offByOneAgent);
      expect(offByOneIp).not.toBe(offByOneAgent);

      // And not just different by one character (SHA-256 avalanche effect)
      const differences1 = countDifferentChars(base, offByOneIp);
      const differences2 = countDifferentChars(base, offByOneAgent);

      // SHA-256 should produce approximately 50% different chars on average
      // With 16 chars, we expect roughly 8 different. Allow some variance.
      expect(differences1).toBeGreaterThan(4);
      expect(differences2).toBeGreaterThan(4);
    });
  });
});

/**
 * Helper function to count different characters between two strings
 */
function countDifferentChars(s1: string, s2: string): number {
  let count = 0;
  const maxLen = Math.max(s1.length, s2.length);
  for (let i = 0; i < maxLen; i++) {
    if (s1[i] !== s2[i]) count++;
  }
  return count;
}
