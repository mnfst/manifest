export function normalizeProviderBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
}

const CLOUDFLARE_ACCOUNT_ID_REGEX = /^[a-f0-9]{32}$/i;

export interface CloudflareCredentials {
  accountId: string;
  apiToken: string;
}

export function parseCloudflareCredentials(value: string): CloudflareCredentials | null {
  const trimmed = value.trim();
  const separatorIndex = trimmed.indexOf(':');
  if (separatorIndex <= 0) return null;

  const accountId = trimmed.slice(0, separatorIndex).trim();
  const apiToken = trimmed.slice(separatorIndex + 1).trim();
  if (!CLOUDFLARE_ACCOUNT_ID_REGEX.test(accountId) || apiToken.length === 0) {
    return null;
  }

  return { accountId, apiToken };
}

export function buildCloudflareAiBaseUrl(value: string): string | null {
  const parsed = parseCloudflareCredentials(value);
  if (!parsed) return null;
  return `https://api.cloudflare.com/client/v4/accounts/${parsed.accountId}/ai`;
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
