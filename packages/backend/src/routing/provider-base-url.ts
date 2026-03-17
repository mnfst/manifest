export function normalizeProviderBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
}

const MINIMAX_SUBSCRIPTION_BASE_URLS = new Set([
  'https://api.minimax.io/anthropic',
  'https://api.minimaxi.com/anthropic',
]);

export function normalizeMinimaxSubscriptionBaseUrl(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' || url.username || url.password) {
      return null;
    }

    const normalized = normalizeProviderBaseUrl(`${url.origin}${url.pathname}`);
    return MINIMAX_SUBSCRIPTION_BASE_URLS.has(normalized) ? normalized : null;
  } catch {
    return null;
  }
}
