import { whitelistResponseHeaders } from './playground-response-headers';

const EXACT_HEADERS = [
  'content-type',
  'date',
  'x-request-id',
  'request-id',
  'openai-model',
  'openai-organization',
  'openai-processing-ms',
  'openai-version',
  'anthropic-ratelimit-requests-limit',
  'anthropic-ratelimit-requests-remaining',
  'anthropic-ratelimit-requests-reset',
  'anthropic-ratelimit-tokens-limit',
  'anthropic-ratelimit-tokens-remaining',
  'anthropic-ratelimit-tokens-reset',
];

describe('whitelistResponseHeaders', () => {
  it('allows all exact-match headers', () => {
    const h = new Headers();
    for (const name of EXACT_HEADERS) h.append(name, `value-for-${name}`);

    const out = whitelistResponseHeaders(h);

    for (const name of EXACT_HEADERS) {
      expect(out[name]).toBe(`value-for-${name}`);
    }
    expect(Object.keys(out).sort()).toEqual([...EXACT_HEADERS].sort());
  });

  it('blocks authorization, cookie, set-cookie, and host headers', () => {
    const h = new Headers();
    h.append('authorization', 'Bearer sk-secret');
    h.append('cookie', 'session=abc');
    h.append('set-cookie', 'session=xyz; HttpOnly');
    h.append('host', 'api.openai.com');
    // Keep one allowed header so we can confirm the function still works.
    h.append('content-type', 'application/json');

    const out = whitelistResponseHeaders(h);

    expect(out['authorization']).toBeUndefined();
    expect(out['cookie']).toBeUndefined();
    expect(out['set-cookie']).toBeUndefined();
    expect(out['host']).toBeUndefined();
    expect(out['content-type']).toBe('application/json');
  });

  it('allows x-ratelimit-, x-manifest-, and ratelimit- prefixes (case-insensitive)', () => {
    const h = new Headers();
    // Mix of casings — Headers normalizes to lowercase internally, but we
    // also rely on the function's defensive .toLowerCase() call.
    h.append('X-RateLimit-Remaining', '99');
    h.append('X-MANIFEST-Tier', 'standard');
    h.append('RateLimit-Reset', '60');
    h.append('x-ratelimit-limit', '100');
    h.append('x-manifest-specificity', 'coding');
    h.append('ratelimit-policy', '100;w=60');

    const out = whitelistResponseHeaders(h);

    // Keys come out lowercased.
    expect(out['x-ratelimit-remaining']).toBe('99');
    expect(out['x-manifest-tier']).toBe('standard');
    expect(out['ratelimit-reset']).toBe('60');
    expect(out['x-ratelimit-limit']).toBe('100');
    expect(out['x-manifest-specificity']).toBe('coding');
    expect(out['ratelimit-policy']).toBe('100;w=60');
  });

  it('lowercases all output header keys for case-insensitive matching', () => {
    // Headers normalizes incoming keys to lowercase on storage, so the
    // .toLowerCase() in the function is defensive. Confirm the contract:
    // every key emitted is already lowercase regardless of input casing.
    const h = new Headers();
    h.append('Content-Type', 'application/json');
    h.append('X-Request-ID', 'req-123');
    h.append('X-RateLimit-Limit', '1000');

    const out = whitelistResponseHeaders(h);

    for (const key of Object.keys(out)) {
      expect(key).toBe(key.toLowerCase());
    }
    expect(out['content-type']).toBe('application/json');
    expect(out['x-request-id']).toBe('req-123');
    expect(out['x-ratelimit-limit']).toBe('1000');
  });

  it('returns an empty object for empty headers', () => {
    expect(whitelistResponseHeaders(new Headers())).toEqual({});
  });

  it('returns an empty object when no headers match the allow-list', () => {
    const h = new Headers();
    h.append('authorization', 'Bearer sk-secret');
    h.append('cookie', 'session=abc');
    h.append('server', 'cloudflare');
    h.append('x-fingerprint', 'browser-id');

    expect(whitelistResponseHeaders(h)).toEqual({});
  });

  it('deduplicates headers with different casing via Headers normalization', () => {
    // The Headers API normalizes keys to lowercase and merges duplicate
    // values with ", ". Confirm we never emit two object keys for the
    // same logical header — even if a provider sends multiple cases.
    const h = new Headers();
    h.append('X-Request-Id', 'first');
    h.append('x-request-id', 'second');
    h.append('X-REQUEST-ID', 'third');

    const out = whitelistResponseHeaders(h);

    // Exactly one lowercase entry — no per-casing duplicates leak through.
    expect(Object.keys(out)).toEqual(['x-request-id']);
    // Headers concatenates duplicate-key appends with ", ".
    expect(out['x-request-id']).toBe('first, second, third');
  });

  it('preserves header values verbatim, including empty strings', () => {
    const h = new Headers();
    h.append('content-type', '');
    h.append('x-request-id', 'req-abc-123');
    h.append('x-ratelimit-remaining', '0');

    const out = whitelistResponseHeaders(h);

    expect(out['content-type']).toBe('');
    expect(out['x-request-id']).toBe('req-abc-123');
    expect(out['x-ratelimit-remaining']).toBe('0');
  });

  it('does not match prefixes mid-string (startsWith only)', () => {
    // "my-x-ratelimit-remaining" must NOT match the "x-ratelimit-" prefix.
    // The startsWith() check is the security boundary — a substring match
    // would let custom-prefixed headers leak through.
    const h = new Headers();
    h.append('my-x-ratelimit-remaining', '50');
    h.append('foo-x-manifest-tier', 'cheap');
    h.append('not-ratelimit-policy', 'spoof');

    expect(whitelistResponseHeaders(h)).toEqual({});
  });

  it('does not match exact-list headers via a partial substring', () => {
    // Only exact lowercase matches should pass. "openai-model-foo" must
    // not slip through just because "openai-model" is whitelisted.
    const h = new Headers();
    h.append('openai-model-foo', 'leak');
    h.append('content-type-extra', 'leak');
    h.append('xx-date', 'leak');

    expect(whitelistResponseHeaders(h)).toEqual({});
  });

  it('mixes allowed and blocked headers correctly in one pass', () => {
    const h = new Headers();
    // Allowed (exact)
    h.append('content-type', 'application/json');
    h.append('openai-model', 'gpt-4o');
    // Allowed (prefix)
    h.append('x-ratelimit-remaining', '99');
    h.append('x-manifest-tier', 'standard');
    // Blocked
    h.append('authorization', 'Bearer sk-secret');
    h.append('cookie', 'session=abc');
    h.append('server', 'cloudflare');

    const out = whitelistResponseHeaders(h);

    expect(out).toEqual({
      'content-type': 'application/json',
      'openai-model': 'gpt-4o',
      'x-ratelimit-remaining': '99',
      'x-manifest-tier': 'standard',
    });
  });
});
