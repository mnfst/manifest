import { parseOAuthTokenBlob, oauthDoneHtml } from './oauth/openai-oauth.types';

describe('parseOAuthTokenBlob', () => {
  it('returns null when the optional resource URL is not a string', () => {
    expect(parseOAuthTokenBlob(JSON.stringify({ t: 'token', r: 'refresh', e: 123, u: 42 }))).toBe(
      null,
    );
  });

  it('returns the parsed blob when the optional resource URL is a string', () => {
    expect(
      parseOAuthTokenBlob(
        JSON.stringify({
          t: 'token',
          r: 'refresh',
          e: 123,
          u: 'https://api.minimax.io/anthropic',
        }),
      ),
    ).toEqual({
      t: 'token',
      r: 'refresh',
      e: 123,
      u: 'https://api.minimax.io/anthropic',
    });
  });

  it('returns parsed blob without u field when u is undefined', () => {
    expect(parseOAuthTokenBlob(JSON.stringify({ t: 'tok', r: 'ref', e: 999 }))).toEqual({
      t: 'tok',
      r: 'ref',
      e: 999,
    });
  });

  it('returns null when input is not valid JSON', () => {
    expect(parseOAuthTokenBlob('not-json')).toBe(null);
  });
});

describe('oauthDoneHtml', () => {
  it('includes nonce attribute on script tag when provided', () => {
    const html = oauthDoneHtml(true, 'test-nonce-123');
    expect(html).toContain('nonce="test-nonce-123"');
    expect(html).toContain('manifest-oauth-success');
  });

  it('omits nonce attribute when not provided', () => {
    const html = oauthDoneHtml(true);
    expect(html).not.toContain('nonce=');
    expect(html).toContain('<script>');
  });

  it('renders error message when success is false', () => {
    const html = oauthDoneHtml(false, 'nonce-abc');
    expect(html).toContain('manifest-oauth-error');
    expect(html).toContain('Login failed');
    expect(html).toContain('nonce="nonce-abc"');
  });
});
