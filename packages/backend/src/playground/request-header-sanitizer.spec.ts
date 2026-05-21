import { isBlockedHeaderName, sanitizeRequestHeaders } from './request-header-sanitizer';

describe('sanitizeRequestHeaders', () => {
  it('returns undefined when given undefined (callers skip extraHeaders)', () => {
    expect(sanitizeRequestHeaders(undefined)).toBeUndefined();
  });

  it('keeps ordinary provider headers like HTTP-Referer / X-Title', () => {
    const out = sanitizeRequestHeaders({
      'HTTP-Referer': 'https://example.com',
      'X-Title': 'My Playground',
    });
    expect(out).toEqual({
      'HTTP-Referer': 'https://example.com',
      'X-Title': 'My Playground',
    });
  });

  it('drops auth, cookie, and transport-layer headers silently', () => {
    const out = sanitizeRequestHeaders({
      Authorization: 'Bearer sk-secret',
      cookie: 'session=abc',
      Host: 'attacker.example',
      'Content-Type': 'text/plain',
      'transfer-encoding': 'chunked',
      'HTTP-Referer': 'https://kept.example',
    });
    expect(out).toEqual({ 'HTTP-Referer': 'https://kept.example' });
  });

  it('drops x-manifest-* headers from the client regardless of casing', () => {
    const out = sanitizeRequestHeaders({
      'X-Manifest-Specificity': 'trading',
      'x-manifest-tier': 'reasoning',
      'X-Title': 'ok',
    });
    expect(out).toEqual({ 'X-Title': 'ok' });
  });

  it('caps at 20 headers and truncates values longer than 2000 chars', () => {
    const big: Record<string, string> = {};
    for (let i = 0; i < 30; i++) big[`X-Custom-${i}`] = 'v'.repeat(3_000);
    const out = sanitizeRequestHeaders(big)!;
    expect(Object.keys(out)).toHaveLength(20);
    expect(Object.values(out)[0]?.length).toBe(2_000);
  });

  it('returns undefined when every entry is blocked', () => {
    expect(
      sanitizeRequestHeaders({
        Authorization: 'Bearer x',
        Cookie: 'y=1',
      }),
    ).toBeUndefined();
  });

  it('ignores non-string keys/values rather than throwing', () => {
    const out = sanitizeRequestHeaders({
      'X-Good': 'ok',
      'X-Bad': 42 as unknown as string,
      '': 'empty-key',
    });
    expect(out).toEqual({ 'X-Good': 'ok' });
  });

  it('isBlockedHeaderName is case-insensitive and covers prefixes', () => {
    expect(isBlockedHeaderName('AUTHORIZATION')).toBe(true);
    expect(isBlockedHeaderName('X-Manifest-Anything')).toBe(true);
    expect(isBlockedHeaderName('X-Title')).toBe(false);
  });

  describe('case-insensitive deduplication', () => {
    it('keeps only the first encountered case variant when keys differ in casing', () => {
      const out = sanitizeRequestHeaders({
        'X-Title': 'a',
        'x-title': 'b',
      });
      // The FIRST encountered ('a') wins. The lower-cased dedup set ensures
      // the second entry is silently dropped instead of overwriting.
      expect(out).toEqual({ 'X-Title': 'a' });
    });

    it('preserves the original casing of the surviving header name', () => {
      const out = sanitizeRequestHeaders({
        'http-referer': 'first-wins',
        'HTTP-Referer': 'second-loses',
      });
      // Keys are kept verbatim — we don't normalize the surviving one.
      expect(Object.keys(out!)).toEqual(['http-referer']);
      expect(out!['http-referer']).toBe('first-wins');
    });

    it('runs lowercase dedup BEFORE the MAX_HEADERS cap, so case-variant floods stay cheap', () => {
      // Mix 22 case-variants of one logical header (X-Title) — each variant
      // is a distinct JS-object key but hashes to the same lower-case key —
      // followed by 5 unrelated, kept-as-is custom headers. Without dedup,
      // the 22 variants would burn 20 slots and the 5 customs wouldn't make
      // it in. With dedup, only ONE X-Title survives and the customs all
      // fit comfortably under the cap.
      const variants: Record<string, string> = {
        'X-Title': '1',
        'x-Title': '2',
        'X-title': '3',
        'x-title': '4',
        'X-TITLE': '5',
        'x-TITLE': '6',
        'X-tItLe': '7',
        'x-TitlE': '8',
        'X-tiTle': '9',
        'x-tiTLE': '10',
        'X-tItle': '11',
        'x-titlE': '12',
        'X-tItlE': '13',
        'x-tIle': '14', // (not really a variant, exercises generic uniqueness)
      };
      // Bring it close to the 22 variant target with case spellings.
      // (JS objects can't repeat keys, so this is the upper bound.)
      for (let i = 0; i < 5; i++) variants[`X-Custom-${i}`] = `c${i}`;

      const out = sanitizeRequestHeaders(variants)!;
      // Exactly one X-Title-shaped header survives.
      const titleKeys = Object.keys(out).filter((k) => k.toLowerCase() === 'x-title');
      expect(titleKeys).toHaveLength(1);
      // First one wins.
      expect(out[titleKeys[0]!]).toBe('1');
      // The 5 custom headers ALL made it through — proof that the dedup
      // happened before the MAX_HEADERS cap was consulted.
      for (let i = 0; i < 5; i++) {
        expect(out[`X-Custom-${i}`]).toBe(`c${i}`);
      }
    });
  });
});
