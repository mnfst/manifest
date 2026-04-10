import type { SubscriptionProviderConfig } from './types';

export const SUBSCRIPTION_PROVIDER_CONFIGS: Readonly<
  Record<string, Readonly<SubscriptionProviderConfig>>
> = Object.freeze({
  anthropic: Object.freeze({
    supportsSubscription: true as const,
    subscriptionLabel: 'Claude Max / Pro subscription',
    subscriptionAuthMode: 'token' as const,
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
    supportsSubscription: true as const,
    subscriptionLabel: 'ChatGPT Plus/Pro/Team',
    subscriptionAuthMode: 'popup_oauth' as const,
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
    supportsSubscription: true as const,
    subscriptionLabel: 'MiniMax Coding Plan',
    subscriptionAuthMode: 'device_code' as const,
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
  'ollama-cloud': Object.freeze({
    supportsSubscription: true as const,
    subscriptionLabel: 'Ollama Cloud subscription',
    subscriptionAuthMode: 'token' as const,
    subscriptionKeyPlaceholder: 'Paste your Ollama API key',
    // No subscriptionTokenPrefix — Ollama Cloud accepts any API key format.
    subscriptionCapabilities: Object.freeze({
      maxContextWindow: 128000,
      supportsPromptCaching: false,
      supportsBatching: false,
    }),
  }),
  zai: Object.freeze({
    supportsSubscription: true as const,
    subscriptionLabel: 'GLM Coding Plan',
    subscriptionAuthMode: 'token' as const,
    subscriptionKeyPlaceholder: 'Paste your Z.ai API key',
    knownModels: Object.freeze([
      'glm-5.1',
      'glm-5-turbo',
      'glm-5',
      'glm-4.7',
      'glm-4.6',
      'glm-4.5',
      'glm-4.5-air',
    ]),
    subscriptionCapabilities: Object.freeze({
      // Z.ai advertises "200K" as 200 * 1024 = 204800, not 200000 like other providers.
      maxContextWindow: 204800,
      supportsPromptCaching: false,
      supportsBatching: false,
    }),
  }),
  copilot: Object.freeze({
    supportsSubscription: true as const,
    subscriptionLabel: 'GitHub Copilot subscription',
    subscriptionAuthMode: 'device_code' as const,
    knownModels: Object.freeze([
      'copilot/claude-opus-4.6',
      'copilot/claude-sonnet-4.6',
      'copilot/claude-haiku-4.5',
      'copilot/gpt-5.4',
      'copilot/gpt-5.2-codex',
      'copilot/gpt-5-mini',
      'copilot/gpt-4.1',
      'copilot/gpt-4o',
      'copilot/gpt-4o-mini',
      'copilot/gemini-3.1-pro-preview',
      'copilot/grok-code-fast-1',
    ]),
    subscriptionCapabilities: Object.freeze({
      maxContextWindow: 200000,
      supportsPromptCaching: false,
      supportsBatching: false,
    }),
  }),
});

export const SUPPORTED_SUBSCRIPTION_PROVIDER_IDS: readonly string[] = Object.freeze(
  Object.keys(SUBSCRIPTION_PROVIDER_CONFIGS),
);
