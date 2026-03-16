const SUBSCRIPTION_PROVIDER_CONFIGS = Object.freeze({
  anthropic: Object.freeze({
    supportsSubscription: true,
    subscriptionLabel: 'Claude Max / Pro subscription',
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
  getSubscriptionCapabilities,
};
