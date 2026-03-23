import { parseOAuthTokenBlob } from './openai-oauth.types';

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
});
