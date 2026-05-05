import {
  ModelRoute,
  isModelRoute,
  isModelRouteArray,
  legacyToRoute,
  routeEquals,
  routeToLegacy,
} from '../src/model-route';

describe('routeEquals', () => {
  const base: ModelRoute = { provider: 'openai', authType: 'api_key', model: 'gpt-4o' };

  it('returns true for two null routes', () => {
    expect(routeEquals(null, null)).toBe(true);
  });

  it('returns true for two undefined routes', () => {
    expect(routeEquals(undefined, undefined)).toBe(true);
  });

  it('returns false when only one side is null', () => {
    expect(routeEquals(base, null)).toBe(false);
    expect(routeEquals(null, base)).toBe(false);
  });

  it('returns false when only one side is undefined', () => {
    expect(routeEquals(base, undefined)).toBe(false);
    expect(routeEquals(undefined, base)).toBe(false);
  });

  it('returns true for identical routes', () => {
    expect(routeEquals(base, { ...base })).toBe(true);
  });

  it('compares provider case-insensitively', () => {
    expect(routeEquals(base, { ...base, provider: 'OpenAI' })).toBe(true);
    expect(routeEquals(base, { ...base, provider: 'OPENAI' })).toBe(true);
  });

  it('returns false when providers differ semantically', () => {
    expect(routeEquals(base, { ...base, provider: 'anthropic' })).toBe(false);
  });

  it('returns false when models differ', () => {
    expect(routeEquals(base, { ...base, model: 'gpt-5' })).toBe(false);
  });

  it('returns false when authType differs', () => {
    expect(routeEquals(base, { ...base, authType: 'subscription' })).toBe(false);
  });

  it('treats null and undefined inputs as not equal to a real route', () => {
    expect(routeEquals(null, undefined)).toBe(false);
    expect(routeEquals(undefined, null)).toBe(false);
  });
});

describe('isModelRoute', () => {
  it('returns true for a valid ModelRoute object', () => {
    expect(isModelRoute({ provider: 'openai', authType: 'api_key', model: 'gpt-4o' })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isModelRoute(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isModelRoute(undefined)).toBe(false);
  });

  it('returns false for a primitive', () => {
    expect(isModelRoute('openai/gpt-4o')).toBe(false);
    expect(isModelRoute(42)).toBe(false);
    expect(isModelRoute(true)).toBe(false);
  });

  it('returns false when provider is missing', () => {
    expect(isModelRoute({ authType: 'api_key', model: 'gpt-4o' })).toBe(false);
  });

  it('returns false when authType is missing', () => {
    expect(isModelRoute({ provider: 'openai', model: 'gpt-4o' })).toBe(false);
  });

  it('returns false when model is missing', () => {
    expect(isModelRoute({ provider: 'openai', authType: 'api_key' })).toBe(false);
  });

  it('returns false when any field is the wrong type', () => {
    expect(isModelRoute({ provider: 1, authType: 'api_key', model: 'gpt-4o' })).toBe(false);
    expect(isModelRoute({ provider: 'openai', authType: null, model: 'gpt-4o' })).toBe(false);
    expect(isModelRoute({ provider: 'openai', authType: 'api_key', model: 99 })).toBe(false);
  });

  it('does not validate the AuthType string contents (structural guard only)', () => {
    // The type guard intentionally only checks `typeof === string`. AuthType
    // value validity is enforced elsewhere in the read pipeline, so a
    // non-canonical string still passes the structural shape check.
    expect(isModelRoute({ provider: 'openai', authType: 'mystery', model: 'm' })).toBe(true);
  });
});

describe('isModelRouteArray', () => {
  const valid: ModelRoute = { provider: 'openai', authType: 'api_key', model: 'gpt-4o' };

  it('returns true for an empty array', () => {
    expect(isModelRouteArray([])).toBe(true);
  });

  it('returns true for an array of valid routes', () => {
    expect(isModelRouteArray([valid, { ...valid, model: 'gpt-5' }])).toBe(true);
  });

  it('returns false when not an array', () => {
    expect(isModelRouteArray(null)).toBe(false);
    expect(isModelRouteArray(undefined)).toBe(false);
    expect(isModelRouteArray(valid)).toBe(false);
    expect(isModelRouteArray('foo')).toBe(false);
  });

  it('returns false when any entry is invalid', () => {
    expect(isModelRouteArray([valid, { provider: 'openai' }])).toBe(false);
    expect(isModelRouteArray([valid, null])).toBe(false);
    expect(isModelRouteArray([valid, 'gpt-4o'])).toBe(false);
  });
});

describe('legacyToRoute', () => {
  it('returns null when model is missing', () => {
    expect(legacyToRoute({ model: null, provider: 'openai', authType: 'api_key' })).toBeNull();
  });

  it('returns null when provider is missing', () => {
    expect(legacyToRoute({ model: 'gpt-4o', provider: null, authType: 'api_key' })).toBeNull();
  });

  it('returns null when authType is missing', () => {
    expect(legacyToRoute({ model: 'gpt-4o', provider: 'openai', authType: null })).toBeNull();
  });

  it('returns null when all fields are null', () => {
    expect(legacyToRoute({ model: null, provider: null, authType: null })).toBeNull();
  });

  it('builds a route when all three fields are present', () => {
    expect(
      legacyToRoute({ model: 'gpt-4o', provider: 'openai', authType: 'api_key' }),
    ).toEqual({
      provider: 'openai',
      authType: 'api_key',
      model: 'gpt-4o',
    });
  });
});

describe('routeToLegacy', () => {
  it('returns all-null triple for a null route', () => {
    expect(routeToLegacy(null)).toEqual({ model: null, provider: null, authType: null });
  });

  it('decomposes a route into a legacy triple', () => {
    expect(
      routeToLegacy({ provider: 'anthropic', authType: 'subscription', model: 'claude-opus' }),
    ).toEqual({
      model: 'claude-opus',
      provider: 'anthropic',
      authType: 'subscription',
    });
  });
});

describe('legacyToRoute / routeToLegacy round-trip', () => {
  it('round-trips losslessly through both directions', () => {
    const route: ModelRoute = {
      provider: 'anthropic',
      authType: 'subscription',
      model: 'claude-opus',
    };
    const triple = routeToLegacy(route);
    expect(legacyToRoute(triple)).toEqual(route);
  });

  it('round-trips a missing route through null', () => {
    expect(legacyToRoute(routeToLegacy(null))).toBeNull();
  });
});
