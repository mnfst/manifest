import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getPivotClaimUrl,
  hasPivotJoined,
  markPivotJoined,
  submitPivotClaim,
} from '../../src/services/waitlist';

const mockFetch = vi.fn();

describe('waitlist service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('getPivotClaimUrl', () => {
    it('stays same-origin on cloud', () => {
      expect(getPivotClaimUrl(false, false)).toBe('/api/v1/waitlist/pivot/claim');
    });

    it('targets the cloud endpoint from production self-hosted', () => {
      expect(getPivotClaimUrl(true, false)).toBe(
        'https://app.manifest.build/api/v1/waitlist/pivot/claim',
      );
    });

    it('stays same-origin in dev so no test traffic reaches production', () => {
      expect(getPivotClaimUrl(true, true)).toBe('/api/v1/waitlist/pivot/claim');
    });
  });

  describe('joined state', () => {
    it('persists per user', () => {
      expect(hasPivotJoined('u1')).toBe(false);
      markPivotJoined('u1');
      expect(hasPivotJoined('u1')).toBe(true);
      expect(hasPivotJoined('u2')).toBe(false);
    });

    it('ignores an empty user id', () => {
      markPivotJoined('');
      expect(hasPivotJoined('')).toBe(false);
    });

    it('swallows storage errors', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota');
      });
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('unavailable');
      });
      expect(() => markPivotJoined('u1')).not.toThrow();
      expect(hasPivotJoined('u1')).toBe(false);
    });
  });

  describe('submitPivotClaim', () => {
    it('posts the email as JSON and reports success', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      await expect(submitPivotClaim('jane@example.com', false)).resolves.toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/waitlist/pivot/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'jane@example.com' }),
      });
    });

    it('reports failure on a non-2xx response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 400 });
      await expect(submitPivotClaim('bad', false)).resolves.toBe(false);
    });

    it('reports failure when the request throws', async () => {
      mockFetch.mockRejectedValue(new Error('network down'));
      await expect(submitPivotClaim('jane@example.com', true)).resolves.toBe(false);
    });
  });
});
