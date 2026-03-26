import {
  SUBSCRIPTION_PROVIDER_CONFIGS,
  SUPPORTED_SUBSCRIPTION_PROVIDER_IDS,
  getSubscriptionProviderConfig,
  supportsSubscriptionProvider,
  getSubscriptionKnownModels,
  getSubscriptionCapabilities,
} from '../src/subscription';

describe('SUBSCRIPTION_PROVIDER_CONFIGS', () => {
  it('contains anthropic, openai, minimax, copilot', () => {
    expect(Object.keys(SUBSCRIPTION_PROVIDER_CONFIGS)).toEqual(
      expect.arrayContaining(['anthropic', 'openai', 'minimax', 'copilot']),
    );
  });

  it('is frozen', () => {
    expect(Object.isFrozen(SUBSCRIPTION_PROVIDER_CONFIGS)).toBe(true);
  });
});

describe('SUPPORTED_SUBSCRIPTION_PROVIDER_IDS', () => {
  it('matches the keys of SUBSCRIPTION_PROVIDER_CONFIGS', () => {
    expect([...SUPPORTED_SUBSCRIPTION_PROVIDER_IDS].sort()).toEqual(
      Object.keys(SUBSCRIPTION_PROVIDER_CONFIGS).sort(),
    );
  });
});

describe('getSubscriptionProviderConfig', () => {
  it('returns config for anthropic', () => {
    const config = getSubscriptionProviderConfig('anthropic');
    expect(config).toMatchObject({
      supportsSubscription: true,
      subscriptionLabel: 'Claude Max / Pro subscription',
      subscriptionAuthMode: 'token',
    });
  });

  it('returns config for openai', () => {
    const config = getSubscriptionProviderConfig('openai');
    expect(config).toMatchObject({
      supportsSubscription: true,
      subscriptionAuthMode: 'popup_oauth',
      subscriptionOAuth: true,
    });
  });

  it('returns config for minimax', () => {
    const config = getSubscriptionProviderConfig('minimax');
    expect(config).toMatchObject({
      subscriptionAuthMode: 'device_code',
    });
  });

  it('returns config for copilot', () => {
    const config = getSubscriptionProviderConfig('copilot');
    expect(config).toMatchObject({
      subscriptionLabel: 'GitHub Copilot subscription',
      subscriptionAuthMode: 'device_code',
    });
  });

  it('is case-insensitive', () => {
    expect(getSubscriptionProviderConfig('ANTHROPIC')).not.toBeNull();
    expect(getSubscriptionProviderConfig('OpenAI')).not.toBeNull();
  });

  it('returns null for unsupported providers', () => {
    expect(getSubscriptionProviderConfig('unknown')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getSubscriptionProviderConfig('')).toBeNull();
  });
});

describe('supportsSubscriptionProvider', () => {
  it('returns true for supported providers', () => {
    expect(supportsSubscriptionProvider('anthropic')).toBe(true);
    expect(supportsSubscriptionProvider('openai')).toBe(true);
    expect(supportsSubscriptionProvider('minimax')).toBe(true);
    expect(supportsSubscriptionProvider('copilot')).toBe(true);
  });

  it('returns false for unsupported providers', () => {
    expect(supportsSubscriptionProvider('deepseek')).toBe(false);
    expect(supportsSubscriptionProvider('mistral')).toBe(false);
  });
});

describe('getSubscriptionKnownModels', () => {
  it('returns known models for anthropic', () => {
    const models = getSubscriptionKnownModels('anthropic');
    expect(models).toContain('claude-opus-4');
    expect(models).toContain('claude-sonnet-4');
  });

  it('returns known models for copilot', () => {
    const models = getSubscriptionKnownModels('copilot');
    expect(models).toContain('copilot/claude-opus-4.6');
    expect(models).toContain('copilot/gpt-5.4');
  });

  it('returns null for unsupported providers', () => {
    expect(getSubscriptionKnownModels('unknown')).toBeNull();
  });
});

describe('getSubscriptionCapabilities', () => {
  it('returns capabilities for anthropic', () => {
    const caps = getSubscriptionCapabilities('anthropic');
    expect(caps).toMatchObject({
      maxContextWindow: 200000,
      supportsPromptCaching: false,
      supportsBatching: false,
    });
  });

  it('returns capabilities for all supported providers', () => {
    for (const id of SUPPORTED_SUBSCRIPTION_PROVIDER_IDS) {
      const caps = getSubscriptionCapabilities(id);
      expect(caps).not.toBeNull();
      expect(caps!.maxContextWindow).toBe(200000);
    }
  });

  it('returns null for unsupported providers', () => {
    expect(getSubscriptionCapabilities('unknown')).toBeNull();
  });
});
