import { isOAuthTokenBlob, parseOAuthTokenBlob, serializeOAuthTokenBlob } from './oauth-blob';

describe('oauth-blob', () => {
  describe('isOAuthTokenBlob', () => {
    it('accepts the minimum shape', () => {
      expect(isOAuthTokenBlob({ t: 'access', r: 'refresh', e: 123 })).toBe(true);
    });

    it('accepts the optional resource URL field', () => {
      expect(isOAuthTokenBlob({ t: 'a', r: 'b', e: 1, u: 'https://x' })).toBe(true);
    });

    it('rejects missing or wrong-typed fields', () => {
      expect(isOAuthTokenBlob(null)).toBe(false);
      expect(isOAuthTokenBlob('string')).toBe(false);
      expect(isOAuthTokenBlob({})).toBe(false);
      expect(isOAuthTokenBlob({ t: 'a', r: 'b' })).toBe(false); // missing e
      expect(isOAuthTokenBlob({ t: 'a', r: 'b', e: '1' })).toBe(false); // e wrong type
      expect(isOAuthTokenBlob({ t: 'a', r: 'b', e: 1, u: 5 })).toBe(false); // u wrong type
    });
  });

  describe('parseOAuthTokenBlob', () => {
    it('round-trips a serialized blob', () => {
      const blob = { t: 'access', r: 'refresh', e: 1234 };
      expect(parseOAuthTokenBlob(serializeOAuthTokenBlob(blob))).toEqual(blob);
    });

    it('preserves the optional resource URL when present', () => {
      const blob = { t: 'a', r: 'b', e: 5, u: 'https://api.example.com' };
      expect(parseOAuthTokenBlob(serializeOAuthTokenBlob(blob))).toEqual(blob);
    });

    it('omits the resource URL field when not present', () => {
      const parsed = parseOAuthTokenBlob('{"t":"a","r":"b","e":5}');
      expect(parsed).toEqual({ t: 'a', r: 'b', e: 5 });
      expect(parsed!.u).toBeUndefined();
    });

    it('returns null for malformed JSON', () => {
      expect(parseOAuthTokenBlob('not-json')).toBeNull();
      expect(parseOAuthTokenBlob('')).toBeNull();
    });

    it('returns null when JSON parses but the shape is wrong', () => {
      expect(parseOAuthTokenBlob('{}')).toBeNull();
      expect(parseOAuthTokenBlob('{"t":"a"}')).toBeNull();
    });
  });
});
