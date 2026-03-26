import { AUTH_TYPES, AuthType } from '../src/auth-types';

describe('AUTH_TYPES', () => {
  it('contains api_key and subscription', () => {
    expect(AUTH_TYPES).toEqual(['api_key', 'subscription']);
  });

  it('has exactly two entries', () => {
    expect(AUTH_TYPES).toHaveLength(2);
  });
});

describe('AuthType', () => {
  it('accepts valid auth type values', () => {
    const types: AuthType[] = ['api_key', 'subscription'];
    expect(types).toHaveLength(2);
  });
});
