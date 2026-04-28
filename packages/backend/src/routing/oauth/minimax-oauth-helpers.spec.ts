import {
  buildMinimaxCodeUrl,
  buildMinimaxResourceUrl,
  buildMinimaxTokenUrl,
  DEFAULT_BASE_URL,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_REGION,
  DEFAULT_RESOURCE_URL,
  getMinimaxBaseUrl,
  getMinimaxOauthBaseUrl,
  getMinimaxResourceUrl,
  isMinimaxRegion,
  isOAuthTokenBlob,
  MINIMAX_BASE_URLS,
  toAbsoluteExpiryTimestamp,
  toPollIntervalMs,
} from './minimax-oauth-helpers';

describe('minimax-oauth-helpers', () => {
  it('exposes the correct default region and base URLs', () => {
    expect(DEFAULT_REGION).toBe('global');
    expect(DEFAULT_BASE_URL).toBe('https://api.minimax.io');
    expect(DEFAULT_RESOURCE_URL).toBe('https://api.minimax.io/anthropic');
    expect(MINIMAX_BASE_URLS.cn).toBe('https://api.minimaxi.com');
  });

  describe('isMinimaxRegion', () => {
    it('accepts the two known regions', () => {
      expect(isMinimaxRegion('global')).toBe(true);
      expect(isMinimaxRegion('cn')).toBe(true);
    });

    it('rejects anything else (including undefined)', () => {
      expect(isMinimaxRegion(undefined)).toBe(false);
      expect(isMinimaxRegion('GLOBAL')).toBe(false);
      expect(isMinimaxRegion('us')).toBe(false);
    });
  });

  describe('URL builders', () => {
    it('defaults getMinimaxBaseUrl to the global region', () => {
      expect(getMinimaxBaseUrl()).toBe(MINIMAX_BASE_URLS.global);
      expect(getMinimaxBaseUrl('cn')).toBe(MINIMAX_BASE_URLS.cn);
    });

    it('builds the code, token and resource URLs as string concatenations', () => {
      expect(buildMinimaxCodeUrl('https://api.minimax.io')).toBe(
        'https://api.minimax.io/oauth/code',
      );
      expect(buildMinimaxTokenUrl('https://api.minimax.io')).toBe(
        'https://api.minimax.io/oauth/token',
      );
      expect(buildMinimaxResourceUrl('https://api.minimax.io')).toBe(
        'https://api.minimax.io/anthropic',
      );
    });
  });

  describe('getMinimaxResourceUrl', () => {
    it('returns null for falsy input', () => {
      expect(getMinimaxResourceUrl(undefined)).toBeNull();
      expect(getMinimaxResourceUrl('')).toBeNull();
    });

    it('normalises a resource URL through the provider-base-url helper', () => {
      // The helper is a pass-through for well-formed resource URLs.
      expect(getMinimaxResourceUrl('https://api.minimax.io/anthropic')).toBe(
        'https://api.minimax.io/anthropic',
      );
    });
  });

  describe('getMinimaxOauthBaseUrl', () => {
    it('falls back to the default base URL when the resource URL is missing', () => {
      expect(getMinimaxOauthBaseUrl(undefined)).toBe(DEFAULT_BASE_URL);
    });

    it('returns the origin of a normalised resource URL', () => {
      expect(getMinimaxOauthBaseUrl('https://api.minimaxi.com/anthropic')).toBe(
        'https://api.minimaxi.com',
      );
    });
  });

  describe('toAbsoluteExpiryTimestamp', () => {
    it('treats small numbers as seconds-from-now', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-20T12:00:00Z'));
      expect(toAbsoluteExpiryTimestamp(60)).toBe(Date.now() + 60_000);
      jest.useRealTimers();
    });

    it('passes already-absolute millisecond timestamps through unchanged', () => {
      // 10_000_000_001 > 10_000_000_000 threshold → treated as absolute epoch ms.
      expect(toAbsoluteExpiryTimestamp(10_000_000_001)).toBe(10_000_000_001);
    });
  });

  describe('toPollIntervalMs', () => {
    it('falls back to the default for missing or zero/negative values', () => {
      expect(toPollIntervalMs(undefined)).toBe(DEFAULT_POLL_INTERVAL_MS);
      expect(toPollIntervalMs(0)).toBe(DEFAULT_POLL_INTERVAL_MS);
      expect(toPollIntervalMs(-10)).toBe(DEFAULT_POLL_INTERVAL_MS);
    });

    it('treats values >= 1000 as already in milliseconds', () => {
      expect(toPollIntervalMs(1500)).toBe(1500);
    });

    it('converts small values (assumed to be seconds) to milliseconds', () => {
      expect(toPollIntervalMs(5)).toBe(5000);
    });
  });

  describe('isOAuthTokenBlob', () => {
    it('accepts a valid blob with or without the optional u field', () => {
      expect(isOAuthTokenBlob({ t: 'a', r: 'b', e: 1 })).toBe(true);
      expect(isOAuthTokenBlob({ t: 'a', r: 'b', e: 1, u: 'x' })).toBe(true);
    });

    it('rejects non-objects and nullish values', () => {
      expect(isOAuthTokenBlob(null)).toBe(false);
      expect(isOAuthTokenBlob(undefined)).toBe(false);
      expect(isOAuthTokenBlob('string')).toBe(false);
      expect(isOAuthTokenBlob(42)).toBe(false);
    });

    it('rejects blobs with missing or wrong-typed fields', () => {
      expect(isOAuthTokenBlob({ r: 'b', e: 1 })).toBe(false);
      expect(isOAuthTokenBlob({ t: 'a', e: 1 })).toBe(false);
      expect(isOAuthTokenBlob({ t: 'a', r: 'b' })).toBe(false);
      expect(isOAuthTokenBlob({ t: 'a', r: 'b', e: 'bad' })).toBe(false);
      expect(isOAuthTokenBlob({ t: 'a', r: 'b', e: Number.NaN })).toBe(false);
      expect(isOAuthTokenBlob({ t: 'a', r: 'b', e: 1, u: 42 })).toBe(false);
    });
  });
});
