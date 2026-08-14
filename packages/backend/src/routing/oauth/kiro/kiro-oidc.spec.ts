import {
  KIRO_DEFAULT_POLL_INTERVAL_MS,
  KIRO_DEFAULT_SCOPES,
  KIRO_OIDC_DEFAULT_REGION,
  KIRO_REGISTER_GRANT_TYPES,
  buildKiroDeviceAuthorizationUrl,
  buildKiroRegisterUrl,
  buildKiroTokenUrl,
  getKiroOidcBaseUrl,
  isKiroOAuthTokenBlob,
  parseKiroOAuthTokenBlob,
  serializeKiroOAuthTokenBlob,
  toAbsoluteExpiryTimestamp,
  toPollIntervalMs,
  type KiroOAuthTokenBlob,
} from './kiro-oidc';

const validBlob: KiroOAuthTokenBlob = {
  source: 'kiro-oidc',
  t: 'access-token',
  r: 'refresh-token',
  e: 1_900_000_000_000,
  cid: 'client-id',
  cs: 'client-secret',
  region: 'us-east-1',
};

describe('kiro-oidc helpers', () => {
  describe('URL builders', () => {
    it('defaults the base URL to the us-east-1 region', () => {
      expect(getKiroOidcBaseUrl()).toBe('https://oidc.us-east-1.amazonaws.com');
      expect(KIRO_OIDC_DEFAULT_REGION).toBe('us-east-1');
    });

    it('builds region-specific base + endpoint URLs', () => {
      const base = getKiroOidcBaseUrl('eu-west-1');
      expect(base).toBe('https://oidc.eu-west-1.amazonaws.com');
      expect(buildKiroRegisterUrl(base)).toBe(`${base}/client/register`);
      expect(buildKiroDeviceAuthorizationUrl(base)).toBe(`${base}/device_authorization`);
      expect(buildKiroTokenUrl(base)).toBe(`${base}/token`);
    });
  });

  describe('toAbsoluteExpiryTimestamp', () => {
    it('treats small values as relative seconds from now', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-26T00:00:00Z'));
      expect(toAbsoluteExpiryTimestamp(3600)).toBe(Date.now() + 3600 * 1000);
      jest.useRealTimers();
    });

    it('passes large values through as absolute timestamps', () => {
      expect(toAbsoluteExpiryTimestamp(1_900_000_000_000)).toBe(1_900_000_000_000);
    });
  });

  describe('toPollIntervalMs', () => {
    it('falls back to the default when interval is missing or non-positive', () => {
      expect(toPollIntervalMs(undefined)).toBe(KIRO_DEFAULT_POLL_INTERVAL_MS);
      expect(toPollIntervalMs(0)).toBe(KIRO_DEFAULT_POLL_INTERVAL_MS);
      expect(toPollIntervalMs(-5)).toBe(KIRO_DEFAULT_POLL_INTERVAL_MS);
    });

    it('converts second-scale intervals to ms but leaves ms-scale untouched', () => {
      expect(toPollIntervalMs(5)).toBe(5000);
      expect(toPollIntervalMs(2500)).toBe(2500);
    });
  });

  describe('isKiroOAuthTokenBlob', () => {
    it('accepts a well-formed blob', () => {
      expect(isKiroOAuthTokenBlob(validBlob)).toBe(true);
    });

    it.each([
      ['null', null],
      ['a string', 'nope'],
      ['wrong source', { ...validBlob, source: 'kiro-cli' }],
      ['missing access token', { ...validBlob, t: '' }],
      ['non-string access token', { ...validBlob, t: 123 }],
      ['missing refresh token', { ...validBlob, r: '' }],
      ['missing clientId', { ...validBlob, cid: 1 }],
      ['missing clientSecret', { ...validBlob, cs: undefined }],
      ['non-finite expiry', { ...validBlob, e: Number.NaN }],
      ['non-number expiry', { ...validBlob, e: '123' }],
    ])('rejects %s', (_label, value) => {
      expect(isKiroOAuthTokenBlob(value)).toBe(false);
    });
  });

  describe('parse/serialize', () => {
    it('round-trips a blob', () => {
      const serialized = serializeKiroOAuthTokenBlob(validBlob);
      expect(parseKiroOAuthTokenBlob(serialized)).toEqual(validBlob);
    });

    it('returns null for valid JSON that is not a blob', () => {
      expect(parseKiroOAuthTokenBlob(JSON.stringify({ hello: 'world' }))).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      expect(parseKiroOAuthTokenBlob('{not json')).toBeNull();
    });
  });

  it('exposes the expected default scopes and grant types', () => {
    expect(KIRO_DEFAULT_SCOPES).toContain('codewhisperer:completions');
    expect(KIRO_REGISTER_GRANT_TYPES).toContain('refresh_token');
  });
});
