import { isBlockedHeaderName, sanitizeRequestHeaders } from './request-header-sanitizer';

describe('sanitizeRequestHeaders', () => {
  it('returns undefined when given undefined (callers skip extraHeaders)', () => {
    expect(sanitizeRequestHeaders(undefined)).toBeUndefined();
  });

  it('keeps ordinary provider headers like HTTP-Referer / X-Title', () => {
    const out = sanitizeRequestHeaders({
      'HTTP-Referer': 'https://example.com',
      'X-Title': 'My Benchmark',
    });
    expect(out).toEqual({
      'HTTP-Referer': 'https://example.com',
      'X-Title': 'My Benchmark',
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

  it('blocks provider API-key headers (x-api-key, api-key, x-goog-api-key)', () => {
    expect(
      sanitizeRequestHeaders({
        'x-api-key': 'sk-evil',
        'API-KEY': 'evil-2',
        'X-Goog-Api-Key': 'AIza-evil',
        'X-Title': 'kept',
      }),
    ).toEqual({ 'X-Title': 'kept' });
  });

  it('blocks provider account/identity headers (openai-organization, openai-project, anthropic-version)', () => {
    expect(
      sanitizeRequestHeaders({
        'OpenAI-Organization': 'org-evil',
        'openai-project': 'proj-evil',
        'Anthropic-Version': '2024-01-01',
        'X-Title': 'kept',
      }),
    ).toEqual({ 'X-Title': 'kept' });
  });

  it('strips control characters (NUL, CR, LF, DEL) from header values', () => {
    const out = sanitizeRequestHeaders({
      'X-Title': 'foo\r\nbar\x00baz\x7fqux',
    });
    expect(out).toEqual({ 'X-Title': 'foobarbazqux' });
  });

  it('drops a header whose value becomes empty after control-char stripping', () => {
    expect(sanitizeRequestHeaders({ 'X-Bad': '\r\n\x00' })).toBeUndefined();
  });

  it('blocks x-aws-* prefix headers', () => {
    expect(isBlockedHeaderName('x-aws-region')).toBe(true);
    expect(isBlockedHeaderName('X-AWS-Date')).toBe(true);
  });
});
