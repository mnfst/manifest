import {
  SUBSCRIPTION_PROVIDER_CONFIGS,
  SUPPORTED_SUBSCRIPTION_PROVIDER_IDS,
  getSubscriptionProviderConfig,
  supportsSubscriptionProvider,
  getSubscriptionKnownModels,
  getSubscriptionCapabilities,
} from '../src/subscription';

describe('SUBSCRIPTION_PROVIDER_CONFIGS', () => {
  it('contains all supported subscription provider IDs', () => {
    expect(Object.keys(SUBSCRIPTION_PROVIDER_CONFIGS)).toEqual(
      expect.arrayContaining([
        'anthropic',
        'openai',
        'minimax',
        'copilot',
        'ollama-cloud',
        'zai',
        'opencode-go',
      ]),
    );
  });

  it('ollama-cloud config is frozen', () => {
    expect(Object.isFrozen(SUBSCRIPTION_PROVIDER_CONFIGS['ollama-cloud'])).toBe(true);
    expect(
      Object.isFrozen(SUBSCRIPTION_PROVIDER_CONFIGS['ollama-cloud'].subscriptionCapabilities),
    ).toBe(true);
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

  it('returns config for ollama-cloud', () => {
    const config = getSubscriptionProviderConfig('ollama-cloud');
    expect(config).toMatchObject({
      supportsSubscription: true,
      subscriptionLabel: 'Ollama Cloud subscription',
      subscriptionAuthMode: 'token',
      subscriptionKeyPlaceholder: 'Paste your Ollama API key',
    });
    // Ollama Cloud accepts any API key format — no prefix constraint.
    expect(config?.subscriptionTokenPrefix).toBeUndefined();
  });

  it('returns config for zai', () => {
    const config = getSubscriptionProviderConfig('zai');
    expect(config).toMatchObject({
      supportsSubscription: true,
      subscriptionLabel: 'GLM Coding Plan',
      subscriptionAuthMode: 'token',
      subscriptionKeyPlaceholder: 'Paste your Z.ai API key',
    });
  });

  it('returns config for opencode-go', () => {
    const config = getSubscriptionProviderConfig('opencode-go');
    expect(config).toMatchObject({
      supportsSubscription: true,
      subscriptionLabel: 'OpenCode Go (beta)',
      subscriptionAuthMode: 'token',
      subscriptionKeyPlaceholder: 'Paste your OpenCode API key',
    });
    expect(config?.subscriptionCapabilities).toMatchObject({
      maxContextWindow: 200000,
      supportsPromptCaching: false,
      supportsBatching: false,
    });
  });

  it('does not publish a hardcoded known-models list for opencode-go', () => {
    const config = getSubscriptionProviderConfig('opencode-go');
    expect(config?.knownModels).toBeUndefined();
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
    expect(supportsSubscriptionProvider('ollama-cloud')).toBe(true);
    expect(supportsSubscriptionProvider('zai')).toBe(true);
    expect(supportsSubscriptionProvider('opencode-go')).toBe(true);
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

  it('returns known models for minimax including M2.7', () => {
    const models = getSubscriptionKnownModels('minimax');
    expect(models).toContain('MiniMax-M2.7');
    expect(models).toContain('MiniMax-M2.7-highspeed');
    expect(models).toContain('MiniMax-M2.5');
  });

  it('returns null known models for ollama-cloud (relies on live /api/tags discovery)', () => {
    const models = getSubscriptionKnownModels('ollama-cloud');
    expect(models).toBeNull();
  });

  it('returns known models for zai', () => {
    const models = getSubscriptionKnownModels('zai');
    expect(models).toContain('glm-5.1');
    expect(models).toContain('glm-5');
    expect(models).toContain('glm-4.7');
  });

  it('returns null for opencode-go (dynamic catalog, no hardcoded list)', () => {
    expect(getSubscriptionKnownModels('opencode-go')).toBeNull();
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
      expect(caps!.maxContextWindow).toBeGreaterThan(0);
      expect(typeof caps!.supportsPromptCaching).toBe('boolean');
      expect(typeof caps!.supportsBatching).toBe('boolean');
    }
  });

  it('returns capabilities for ollama-cloud', () => {
    const caps = getSubscriptionCapabilities('ollama-cloud');
    expect(caps).toMatchObject({
      maxContextWindow: 128000,
      supportsPromptCaching: false,
      supportsBatching: false,
    });
  });

  it('returns capabilities for zai with 204800 context window', () => {
    const caps = getSubscriptionCapabilities('zai');
    expect(caps).toMatchObject({
      maxContextWindow: 204800,
      supportsPromptCaching: false,
      supportsBatching: false,
    });
  });

  it('returns null for unsupported providers', () => {
    expect(getSubscriptionCapabilities('unknown')).toBeNull();
  });
});
