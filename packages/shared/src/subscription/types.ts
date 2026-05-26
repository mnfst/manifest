export interface SubscriptionCapabilities {
  maxContextWindow: number;
  supportsPromptCaching: boolean;
  supportsBatching: boolean;
}

export interface SubscriptionProviderConfig {
  supportsSubscription: true;
  subscriptionLabel: string;
  subscriptionKeyPlaceholder?: string;
  subscriptionCommand?: string;
  subscriptionAuthMode?: 'popup_oauth' | 'device_code' | 'token';
  subscriptionTokenPrefix?: string;
  knownModels?: readonly string[];
  /**
   * How `knownModels` is matched against the OpenRouter pricing cache:
   *   `prefix` (default) — keep any cache entry whose id starts with one
   *     of `knownModels`. Useful for vendors whose OAuth tokens accept
   *     dated suffixes (Anthropic: `claude-opus-4-*`).
   *   `exact` — only keep cache entries whose id matches a `knownModels`
   *     entry verbatim. Use when the subscription endpoint exposes a
   *     strict whitelist (Gemini CodeAssist 404s on suffixed variants).
   */
  knownModelsMatch?: 'prefix' | 'exact';
  subscriptionCapabilities?: Readonly<SubscriptionCapabilities>;
}
