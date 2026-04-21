/**
 * Provider-specific hooks — data-driven lookups that replace scattered
 * `if (provider === 'foo')` chains across the proxy layer.
 *
 * When adding a provider that needs a specialised endpoint for subscription
 * auth, or a custom forward-time header, declare it here rather than adding
 * another `if` branch in the proxy code.
 */

/**
 * Maps `(provider-endpoint-key, auth-type)` → endpoint key for subscription
 * flows. Allows a provider to use a different backend endpoint when the
 * authenticated user is on a subscription plan rather than a per-request key.
 */
const SUBSCRIPTION_ENDPOINT_OVERRIDES: Record<string, string> = {
  openai: 'openai-subscription',
  minimax: 'minimax-subscription',
  zai: 'zai-subscription',
};

export function resolveSubscriptionEndpointKey(endpointKey: string): string | undefined {
  return SUBSCRIPTION_ENDPOINT_OVERRIDES[endpointKey];
}

/**
 * Extra HTTP headers that must be attached at forward-time for specific
 * providers (typically for observability on the provider side).
 */
const PROVIDER_EXTRA_HEADER_BUILDERS: Record<
  string,
  (sessionKey: string) => Record<string, string>
> = {
  xai: (sessionKey) => ({ 'x-grok-conv-id': sessionKey }),
};

export function buildProviderExtraHeaders(
  provider: string,
  sessionKey: string,
): Record<string, string> | undefined {
  const builder = PROVIDER_EXTRA_HEADER_BUILDERS[provider.toLowerCase()];
  if (!builder) return undefined;
  return builder(sessionKey);
}
