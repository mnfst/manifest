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
  /**
   * Case-insensitive substrings that disqualify a model id from the curated
   * subscription catalog, even when it matches `knownModels`. Used to drop
   * pricing-cache entries that look like real models but 404 at the
   * subscription endpoint — e.g. Anthropic's `claude-*-fast` ids, where "fast
   * mode" is an `anthropic-beta` header on the base model, not a model id.
   */
  knownModelsExclude?: readonly string[];
  subscriptionCapabilities?: Readonly<SubscriptionCapabilities>;
}
