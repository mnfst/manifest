import { describe, expect, it } from '@jest/globals';
import { isManifestUsableProvider, isSupportedSubscriptionProvider } from './subscription-support';

describe('subscription-support helpers', () => {
  it('recognizes canonical subscription provider ids', () => {
    expect(isSupportedSubscriptionProvider('gemini')).toBe(true);
    expect(isManifestUsableProvider({ provider: 'gemini', auth_type: 'subscription' })).toBe(true);
  });

  it('recognizes subscription provider aliases', () => {
    expect(isSupportedSubscriptionProvider('google')).toBe(true);
    expect(isManifestUsableProvider({ provider: 'google', auth_type: 'subscription' })).toBe(true);
  });

  it('keeps non-subscription auth records usable regardless of provider support', () => {
    expect(isManifestUsableProvider({ provider: 'deepseek', auth_type: 'api_key' })).toBe(true);
    expect(isManifestUsableProvider({ provider: 'deepseek', auth_type: null })).toBe(true);
  });

  it('rejects unsupported subscription providers', () => {
    expect(isSupportedSubscriptionProvider('deepseek')).toBe(false);
    expect(isManifestUsableProvider({ provider: 'deepseek', auth_type: 'subscription' })).toBe(
      false,
    );
  });
});
