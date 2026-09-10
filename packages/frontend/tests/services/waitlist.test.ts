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
    it('posts the email with the cloud source from cloud deployments', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      await expect(submitPivotClaim('jane@example.com', false)).resolves.toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/waitlist/pivot/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'jane@example.com', source: 'cloud' }),
      });
    });

    it('posts the self-hosted source from self-hosted deployments', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      await submitPivotClaim('jane@example.com', true);
      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body.source).toBe('self-hosted');
    });

    it('retries once without the source field when a pre-source backend answers 400', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 400 })
        .mockResolvedValueOnce({ ok: true });
      await expect(submitPivotClaim('jane@example.com', true)).resolves.toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const retryBody = JSON.parse((mockFetch.mock.calls[1][1] as RequestInit).body as string);
      expect(retryBody).toEqual({ email: 'jane@example.com' });
    });

    it('reports failure when the retry also fails (truly invalid email)', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 400 });
      await expect(submitPivotClaim('bad', false)).resolves.toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('does not retry on non-400 failures', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      await expect(submitPivotClaim('jane@example.com', false)).resolves.toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('reports failure when the request throws', async () => {
      mockFetch.mockRejectedValue(new Error('network down'));
      await expect(submitPivotClaim('jane@example.com', true)).resolves.toBe(false);
    });
  });
});
