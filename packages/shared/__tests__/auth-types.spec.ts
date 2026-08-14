import { AUTH_TYPES, AuthType } from '../src/auth-types';

describe('AUTH_TYPES', () => {
  it('contains api_key, subscription, and local', () => {
    expect(AUTH_TYPES).toEqual(['api_key', 'subscription', 'local']);
  });

  it('has exactly three entries', () => {
    expect(AUTH_TYPES).toHaveLength(3);
  });
});

describe('AuthType', () => {
  it('accepts valid auth type values', () => {
    const types: AuthType[] = ['api_key', 'subscription', 'local'];
    expect(types).toHaveLength(3);
  });
});
