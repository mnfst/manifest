export const SUBSCRIPTION_PROVIDER_CONFIGS = Object.freeze({
  anthropic: Object.freeze({
    supportsSubscription: true,
    subscriptionLabel: 'Claude Max / Pro subscription',
    subscriptionKeyPlaceholder: 'Paste your setup-token',
    subscriptionCommand: 'claude setup-token',
    subscriptionTokenPrefix: 'sk-ant-oat',
  }),
});

export const SUPPORTED_SUBSCRIPTION_PROVIDER_IDS = Object.freeze(
  Object.keys(SUBSCRIPTION_PROVIDER_CONFIGS),
);

function normalizeProviderId(providerId) {
  return String(providerId || '').toLowerCase();
}

export function getSubscriptionProviderConfig(providerId) {
  return SUBSCRIPTION_PROVIDER_CONFIGS[normalizeProviderId(providerId)] ?? null;
}

export function supportsSubscriptionProvider(providerId) {
  return getSubscriptionProviderConfig(providerId) !== null;
}
