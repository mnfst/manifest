import { describe, it, expect } from '@jest/globals';
import { isManifestUsableProvider, isSupportedSubscriptionProvider } from './subscription-support';

describe('isSupportedSubscriptionProvider', () => {
  it('returns true for gemini (canonical id)', () => {
    expect(isSupportedSubscriptionProvider('gemini')).toBe(true);
  });

  it('returns false for google (alias of gemini) because SUBSCRIPTION_PROVIDER_CONFIGS key is gemini', () => {
    // getSubscriptionProviderConfig normalizes the input to lowercase,
    // but the SUBSCRIPTION_PROVIDER_CONFIGS key is 'gemini', not 'google',
    // so this returns false. This is the pre-existing behavior of
    // isSupportedSubscriptionProvider itself.
    expect(isSupportedSubscriptionProvider('google')).toBe(false);
  });
});

describe('isManifestUsableProvider', () => {
  it('returns true for non-subscription auth records regardless of provider', () => {
    expect(isManifestUsableProvider({ provider: 'gemini', auth_type: 'api_key' })).toBe(true);
    expect(isManifestUsableProvider({ provider: 'google', auth_type: 'api_key' })).toBe(true);
    expect(isManifestUsableProvider({ provider: 'openai', auth_type: 'api_key' })).toBe(true);
  });

  it('returns true for local auth type', () => {
    expect(isManifestUsableProvider({ provider: 'gemini', auth_type: 'local' })).toBe(true);
  });

  it('returns true for subscription providers with canonical gemini id', () => {
    expect(isManifestUsableProvider({ provider: 'gemini', auth_type: 'subscription' })).toBe(true);
  });

  it('returns true for subscription providers with google alias (bug fix)', () => {
    // This is the key test for the bug fix. Before the fix, 'google' was not
    // recognized as a supported subscription provider because the provider
    // was not normalized to its canonical form ('gemini') before checking.
    // After the fix, we resolve the provider to its canonical ID using the
    // shared provider registry, so 'google' → 'gemini' → supported.
    expect(isManifestUsableProvider({ provider: 'google', auth_type: 'subscription' })).toBe(true);
  });

  it('returns true for openai subscription', () => {
    expect(isManifestUsableProvider({ provider: 'openai', auth_type: 'subscription' })).toBe(true);
  });

  it('returns false for unsupported subscription providers', () => {
    expect(isManifestUsableProvider({ provider: 'deepseek', auth_type: 'subscription' })).toBe(
      false,
    );
    expect(isManifestUsableProvider({ provider: 'groq', auth_type: 'subscription' })).toBe(false);
  });

  it('handles case-insensitive provider names', () => {
    expect(isManifestUsableProvider({ provider: 'GEMINI', auth_type: 'subscription' })).toBe(true);
    expect(isManifestUsableProvider({ provider: 'Google', auth_type: 'subscription' })).toBe(true);
    expect(isManifestUsableProvider({ provider: 'OPENAI', auth_type: 'subscription' })).toBe(true);
  });

  it('handles null/undefined auth_type as non-subscription', () => {
    expect(isManifestUsableProvider({ provider: 'gemini', auth_type: null })).toBe(true);
    expect(isManifestUsableProvider({ provider: 'gemini', auth_type: undefined })).toBe(true);
  });
});
