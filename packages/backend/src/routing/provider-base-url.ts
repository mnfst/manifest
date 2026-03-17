export function normalizeProviderBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
}
