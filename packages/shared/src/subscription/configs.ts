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
    knownModels: Object.freeze([
      'claude-fable-5',
      'claude-opus-4',
      'claude-sonnet-4',
      'claude-haiku-4',
    ]),
    // `claude-*-fast` ids exist in the OpenRouter pricing cache but 404 at
    // api.anthropic.com — fast mode is an `anthropic-beta` header on the base
    // Opus model, not a distinct model id. Keep them out of the catalog.
    knownModelsExclude: Object.freeze(['-fast']),
    subscriptionCapabilities: Object.freeze({
      maxContextWindow: 200000,
      supportsPromptCaching: false,
      supportsBatching: false,
    }),
  }),
  byteplus: Object.freeze({
    supportsSubscription: true as const,
    subscriptionLabel: 'ModelArk Coding Plan',
    subscriptionAuthMode: 'token' as const,
    subscriptionKeyPlaceholder: 'Paste your ModelArk Coding Plan API key',
    knownModels: Object.freeze([
      'ark-code-latest',
      'bytedance-seed-code',
      'glm-5.1',
      'glm-4.7',
      'deepseek-v3.2',
      'deepseek-v4-flash',
      'deepseek-v4-pro',
      'kimi-k2.5',
      'gpt-oss-120b',
    ]),
    knownModelsMatch: 'exact' as const,
    subscriptionCapabilities: Object.freeze({
      maxContextWindow: 256000,
      supportsPromptCaching: false,
      supportsBatching: false,
    }),
  }),
  openai: Object.freeze({
    supportsSubscription: true as const,
    subscriptionLabel: 'ChatGPT Plus/Pro/Team',
    subscriptionAuthMode: 'popup_oauth' as const,
    knownModels: Object.freeze(['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex-spark']),
    knownModelsMatch: 'exact' as const,
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
      'MiniMax-M3',
      'MiniMax-M2.7',
      'MiniMax-M2.7-highspeed',
      'MiniMax-M2.5',
      'MiniMax-M2.5-highspeed',
      'MiniMax-M2.1',
      'MiniMax-M2.1-highspeed',
      'MiniMax-M2',
    ]),
    subscriptionCapabilities: Object.freeze({
      // MiniMax-M3's 1M window (MSA); M2.x models keep their own lower
      // per-model contexts from the pricing cache — this is only the cap.
      maxContextWindow: 1000000,
      supportsPromptCaching: false,
      supportsBatching: false,
    }),
  }),
  xiaomi: Object.freeze({
    supportsSubscription: true as const,
    subscriptionLabel: 'Xiaomi MiMo Token Plan',
    subscriptionAuthMode: 'token' as const,
    subscriptionKeyPlaceholder: 'Paste your MiMo Token Plan API key',
    subscriptionTokenPrefix: 'tp-',
    knownModels: Object.freeze([
      'mimo-v2.5-pro',
      'mimo-v2-pro',
      'mimo-v2.5',
      'mimo-v2-omni',
      'mimo-v2-flash',
    ]),
    knownModelsMatch: 'exact' as const,
    subscriptionCapabilities: Object.freeze({
      maxContextWindow: 1048576,
      supportsPromptCaching: false,
      supportsBatching: false,
    }),
  }),
  qwen: Object.freeze({
    supportsSubscription: true as const,
    subscriptionLabel: 'Qwen Token Plan',
    subscriptionAuthMode: 'token' as const,
    subscriptionKeyPlaceholder: 'Paste your Qwen Token Plan API key',
    subscriptionTokenPrefix: 'sk-sp-',
    subscriptionCapabilities: Object.freeze({
      maxContextWindow: 991000,
      supportsPromptCaching: false,
      supportsBatching: false,
    }),
  }),
  moonshot: Object.freeze({
    supportsSubscription: true as const,
    subscriptionLabel: 'Kimi Coding Plan',
    subscriptionAuthMode: 'token' as const,
    subscriptionKeyPlaceholder: 'Paste your Kimi Code API key',
    knownModels: Object.freeze(['kimi-for-coding']),
    knownModelsMatch: 'exact' as const,
    subscriptionCapabilities: Object.freeze({
      maxContextWindow: 262144,
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
  kiro: Object.freeze({
    supportsSubscription: true as const,
    subscriptionLabel: 'Kiro subscription',
    subscriptionAuthMode: 'device_code' as const,
    knownModels: Object.freeze([
      'kiro/auto',
      'kiro/claude-sonnet-4.5',
      'kiro/claude-sonnet-4',
      'kiro/claude-haiku-4.5',
      'kiro/deepseek-3.2',
      'kiro/minimax-m2.5',
      'kiro/minimax-m2.1',
      'kiro/glm-5',
      'kiro/qwen3-coder-next',
    ]),
    subscriptionCapabilities: Object.freeze({
      maxContextWindow: 1000000,
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
  'opencode-go': Object.freeze({
    supportsSubscription: true as const,
    subscriptionLabel: 'OpenCode Go (beta)',
    subscriptionAuthMode: 'token' as const,
    subscriptionKeyPlaceholder: 'Paste your OpenCode API key',
    // Model list is fetched dynamically from the public OpenCode Go docs source;
    // see OpencodeGoCatalogService in the backend.
    subscriptionCapabilities: Object.freeze({
      maxContextWindow: 200000,
      supportsPromptCaching: false,
      supportsBatching: false,
    }),
  }),
  gemini: Object.freeze({
    supportsSubscription: true as const,
    subscriptionLabel: 'Sign in with Google',
    subscriptionAuthMode: 'popup_oauth' as const,
    // CodeAssist (gemini-cli) supports a fixed list of Gemini models. The
    // dashboard uses these as fallback when no native /models call returns
    // (CodeAssist does not expose one). Keep this list strict to models that
    // the CodeAssist route recognizes; some current Gemini API model IDs still
    // 404 on the CodeAssist API.
    knownModels: Object.freeze([
      'gemini-3.1-pro-preview',
      'gemini-3-flash-preview',
      'gemini-3.1-flash-lite',
      'gemini-3.1-flash-lite-preview',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ]),
    knownModelsMatch: 'exact' as const,
    subscriptionCapabilities: Object.freeze({
      maxContextWindow: 1000000,
      supportsPromptCaching: false,
      supportsBatching: false,
    }),
  }),
  xai: Object.freeze({
    supportsSubscription: true as const,
    subscriptionLabel: 'Grok subscription',
    subscriptionAuthMode: 'popup_oauth' as const,
    // Model list is fetched dynamically from xAI's OpenAI-compatible /v1/models endpoint.
    subscriptionCapabilities: Object.freeze({
      maxContextWindow: 128000,
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
  commandcode: Object.freeze({
    supportsSubscription: true as const,
    subscriptionLabel: 'Command Code subscription',
    subscriptionAuthMode: 'token' as const,
    subscriptionKeyPlaceholder: 'Paste your Command Code API key',
    // Model list is fetched dynamically from Command Code's public Provider API catalog.
    subscriptionCapabilities: Object.freeze({
      maxContextWindow: 1000000,
      supportsPromptCaching: false,
      supportsBatching: false,
    }),
  }),
});

export const SUPPORTED_SUBSCRIPTION_PROVIDER_IDS: readonly string[] = Object.freeze(
  Object.keys(SUBSCRIPTION_PROVIDER_CONFIGS),
);
