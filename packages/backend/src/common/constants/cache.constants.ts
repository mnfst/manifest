export const DASHBOARD_CACHE_TTL_MS = 30_000;
export const AGENT_LIST_CACHE_TTL_MS = 60_000;
export const MODEL_PRICES_CACHE_TTL_MS = 300_000;
export const PUBLIC_STATS_CACHE_TTL_MS = 86_400_000;
export const FREE_MODELS_CACHE_TTL_MS = 3_600_000;

/**
 * Canonical cache key for the GET /agents list. The route varies only by whether
 * the reserved Playground agent is included, so every query-string
 * variant collapses to one of two keys keyed on that boolean — never the raw
 * URL. This keeps the key set bounded (exactly two per tenant) so invalidation can
 * enumerate it exhaustively and no variant is ever left stale.
 */
export function agentListCacheKey(tenantId: string, includePlayground: boolean): string {
  return `${tenantId}:/api/v1/agents:playground=${includePlayground}`;
}
