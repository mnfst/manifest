import {
  DEFAULT_HOSTED_AUTOFIX_URL,
  resolveHealingUrl,
  resolveHttpHealingUrl,
} from '../autofix-healing-config';

describe('resolveHealingUrl', () => {
  it('accepts an absolute http(s) URL in any mode', () => {
    expect(resolveHealingUrl('https://phoenix.example', 'production', false)).toEqual({
      url: 'https://phoenix.example',
      invalid: false,
    });
    expect(resolveHealingUrl('http://127.0.0.1:3000', 'development', true)).toEqual({
      url: 'http://127.0.0.1:3000',
      invalid: false,
    });
  });

  it('trims surrounding whitespace before judging the value', () => {
    expect(resolveHealingUrl('  https://phoenix.example  ', 'production', true).url).toBe(
      'https://phoenix.example',
    );
  });

  it.each([
    ['a bare host', 'phoenix.example'],
    ['a scheme typo', 'htp://phoenix.example'],
    ['a non-http scheme', 'postgres://user:pw@host:5432/db'],
    ['a path fragment', '/api/heal'],
    ['a path-bearing URL', 'https://phoenix.example/api'],
    ['punctuation only', ':::'],
  ])('rejects %s and reports it as invalid', (_label, value) => {
    // Falls back to inert rather than handing a bad value to fetch(), which
    // would fail per-request on the heal path instead of once at boot.
    expect(resolveHealingUrl(value, 'production', true)).toEqual({ url: undefined, invalid: true });
  });

  it('treats the off sentinel as a deliberate disable, not a misconfiguration', () => {
    expect(resolveHealingUrl('off', 'production', true)).toEqual({
      url: undefined,
      invalid: false,
    });
    expect(resolveHealingUrl('OFF', 'production', true).invalid).toBe(false);
  });

  it('falls back to hosted Phoenix only for self-hosted production', () => {
    expect(resolveHealingUrl(undefined, 'production', true).url).toBe(DEFAULT_HOSTED_AUTOFIX_URL);
    expect(resolveHealingUrl(undefined, 'production', false).url).toBeUndefined();
    expect(resolveHealingUrl(undefined, 'development', true).url).toBeUndefined();
  });

  it('reports an unset URL as valid so dev/test still reaches the mock', () => {
    expect(resolveHealingUrl(undefined, 'development', false)).toEqual({
      url: undefined,
      invalid: false,
    });
    expect(resolveHealingUrl('   ', 'development', false).invalid).toBe(false);
  });

  it('resolveHttpHealingUrl exposes just the url', () => {
    expect(resolveHttpHealingUrl('https://phoenix.example', 'production', true)).toBe(
      'https://phoenix.example',
    );
    expect(resolveHttpHealingUrl('nonsense', 'production', true)).toBeUndefined();
  });
});
