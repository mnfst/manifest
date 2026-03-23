const SUBSCRIPTION_PROVIDER_CONFIGS = Object.freeze({
  anthropic: Object.freeze({
    supportsSubscription: true,
    subscriptionLabel: 'Claude Max / Pro subscription',
    subscriptionAuthMode: 'token',
    subscriptionKeyPlaceholder: 'Paste your setup-token',
    subscriptionCommand: 'claude setup-token',
    subscriptionTokenPrefix: 'sk-ant-oat',
    knownModels: Object.freeze(['claude-opus-4', 'claude-sonnet-4', 'claude-haiku-4']),
    subscriptionCapabilities: Object.freeze({
      maxContextWindow: 200000,
      supportsPromptCaching: false,
      supportsBatching: false,
    }),
  }),
  openai: Object.freeze({
    supportsSubscription: true,
    subscriptionLabel: 'ChatGPT Plus/Pro/Team',
    subscriptionAuthMode: 'popup_oauth',
    subscriptionOAuth: true,
    knownModels: Object.freeze([
      'gpt-5.4',
      'gpt-5.3-codex',
      'gpt-5.2-codex',
      'gpt-5.2',
      'gpt-5.1-codex-max',
      'gpt-5.1-codex',
    ]),
    subscriptionCapabilities: Object.freeze({
      maxContextWindow: 200000,
      supportsPromptCaching: false,
      supportsBatching: false,
    }),
  }),
  minimax: Object.freeze({
    supportsSubscription: true,
    subscriptionLabel: 'MiniMax Coding Plan',
    subscriptionAuthMode: 'device_code',
    knownModels: Object.freeze([
      'MiniMax-M2.5',
      'MiniMax-M2.5-highspeed',
      'MiniMax-M2.1',
      'MiniMax-M2.1-highspeed',
      'MiniMax-M2',
    ]),
    subscriptionCapabilities: Object.freeze({
      maxContextWindow: 200000,
      supportsPromptCaching: false,
      supportsBatching: false,
    }),
  }),
  copilot: Object.freeze({
    supportsSubscription: true,
    subscriptionLabel: 'GitHub Copilot subscription',
    subscriptionAuthMode: 'device_code',
    knownModels: Object.freeze([
      'copilot/claude-opus-4',
      'copilot/claude-sonnet-4.5',
      'copilot/claude-sonnet-4',
      'copilot/claude-haiku-4.5',
      'copilot/gpt-4o',
      'copilot/gpt-4.1',
      'copilot/gpt-5',
      'copilot/o3-mini',
      'copilot/o4-mini',
      'copilot/gemini-2.5-pro',
      'copilot/gemini-2.5-flash',
    ]),
    subscriptionCapabilities: Object.freeze({
      maxContextWindow: 200000,
      supportsPromptCaching: false,
      supportsBatching: false,
    }),
  }),
  'ollama-cloud': Object.freeze({
    supportsSubscription: true,
    subscriptionLabel: 'Ollama Cloud Plan',
    subscriptionAuthMode: 'token',
    subscriptionKeyPlaceholder: 'Paste your API key',
    knownModels: Object.freeze([
      'qwen3-coder:480b',
      'qwen3.5:397b',
      'deepseek-v3.2',
      'glm-5',
      'kimi-k2.5',
      'minimax-m2.7',
    ]),
    alwaysQualifyModelIds: true,
    subscriptionCapabilities: Object.freeze({
      maxContextWindow: 128000,
      supportsPromptCaching: false,
      supportsBatching: false,
    }),
  }),
  'opencode-go': Object.freeze({
    supportsSubscription: true,
    subscriptionLabel: 'OpenCode Go Plan',
    subscriptionAuthMode: 'token',
    subscriptionKeyPlaceholder: 'Paste your API key',
    knownModels: Object.freeze(['glm-5', 'kimi-k2.5', 'minimax-m2.5']),
    knownModelMatchMode: 'exact',
    catalogMode: 'known_only',
    alwaysQualifyModelIds: true,
    subscriptionCapabilities: Object.freeze({
      maxContextWindow: 128000,
      supportsPromptCaching: false,
      supportsBatching: false,
    }),
  }),
  zai: Object.freeze({
    supportsSubscription: true,
    subscriptionLabel: 'Z.ai Coding Plan',
    subscriptionAuthMode: 'token',
    subscriptionKeyPlaceholder: 'Paste your API key',
    knownModels: Object.freeze([
      'glm-5',
      'glm-5-turbo',
      'glm-4.7',
      'glm-4.6',
      'glm-4.5',
      'glm-4.5-air',
    ]),
    subscriptionCapabilities: Object.freeze({
      maxContextWindow: 128000,
      supportsPromptCaching: false,
      supportsBatching: false,
    }),
  }),
});

const SUPPORTED_SUBSCRIPTION_PROVIDER_IDS = Object.freeze(
  Object.keys(SUBSCRIPTION_PROVIDER_CONFIGS),
);

function normalizeProviderId(providerId) {
  return String(providerId || '').toLowerCase();
}

function getSubscriptionProviderConfig(providerId) {
  return SUBSCRIPTION_PROVIDER_CONFIGS[normalizeProviderId(providerId)] ?? null;
}

function supportsSubscriptionProvider(providerId) {
  return getSubscriptionProviderConfig(providerId) !== null;
}

function getSubscriptionKnownModels(providerId) {
  const config = getSubscriptionProviderConfig(providerId);
  return config?.knownModels ?? null;
}

function getSubscriptionKnownModelMatchMode(providerId) {
  const config = getSubscriptionProviderConfig(providerId);
  return config?.knownModelMatchMode ?? 'prefix';
}

function getSubscriptionCatalogMode(providerId) {
  const config = getSubscriptionProviderConfig(providerId);
  return config?.catalogMode ?? 'full';
}

function shouldQualifySubscriptionModelIds(providerId) {
  const config = getSubscriptionProviderConfig(providerId);
  return config?.alwaysQualifyModelIds === true;
}

function getSubscriptionCapabilities(providerId) {
  const config = getSubscriptionProviderConfig(providerId);
  return config?.subscriptionCapabilities ?? null;
}

module.exports = {
  SUBSCRIPTION_PROVIDER_CONFIGS,
  SUPPORTED_SUBSCRIPTION_PROVIDER_IDS,
  getSubscriptionProviderConfig,
  supportsSubscriptionProvider,
  getSubscriptionKnownModels,
  getSubscriptionKnownModelMatchMode,
  getSubscriptionCatalogMode,
  shouldQualifySubscriptionModelIds,
  getSubscriptionCapabilities,
};
