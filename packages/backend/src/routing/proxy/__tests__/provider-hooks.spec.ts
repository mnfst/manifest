import { resolveSubscriptionEndpointKey, buildProviderExtraHeaders } from '../provider-hooks';

describe('resolveSubscriptionEndpointKey', () => {
  it.each([
    ['openai', 'openai-subscription'],
    ['minimax', 'minimax-subscription'],
    ['zai', 'zai-subscription'],
    ['google', 'google-subscription'],
  ])('routes %s subscription to %s', (input, expected) => {
    expect(resolveSubscriptionEndpointKey(input)).toBe(expected);
  });

  it('returns undefined for providers without a subscription endpoint', () => {
    expect(resolveSubscriptionEndpointKey('anthropic')).toBeUndefined();
    expect(resolveSubscriptionEndpointKey('mistral')).toBeUndefined();
  });
});

describe('buildProviderExtraHeaders', () => {
  it('attaches the x-grok-conv-id header for xai (case-insensitive)', () => {
    expect(buildProviderExtraHeaders('xai', 'sess-123')).toEqual({
      'x-grok-conv-id': 'sess-123',
    });
    expect(buildProviderExtraHeaders('XAI', 'sess-123')).toEqual({
      'x-grok-conv-id': 'sess-123',
    });
  });

  it('returns undefined for providers without forward-time header builders', () => {
    expect(buildProviderExtraHeaders('openai', 'sess')).toBeUndefined();
    expect(buildProviderExtraHeaders('gemini', 'sess')).toBeUndefined();
  });
});
