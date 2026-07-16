import type { AuthType } from 'manifest-shared';
import { fetchJson } from './core.js';

export interface TenantProviderConnection {
  id: string;
  label: string;
  key_prefix: string | null;
  priority: number;
  connected_at: string;
  models_fetched_at: string | null;
  cached_model_count: number;
  is_active: boolean;
}

/**
 * CONFIG half of the provider list. Served by `GET /api/v1/providers`, which is
 * cheap (reads `tenant_providers` only) and never touches `agent_messages`.
 * Usage stats live on {@link TenantProviderUsage} and are fetched separately so
 * a config read paints the page immediately.
 */
export interface TenantProviderConfig {
  provider: string;
  auth_type: AuthType;
  /** Backend-resolved name for `custom:<uuid>` groups; null for built-ins. */
  display_name?: string | null;
  connection_count: number;
  connections: TenantProviderConnection[];
  total_models: number;
}

/**
 * USAGE half, keyed by (provider, auth_type). Served by
 * `GET /api/v1/providers/usage` (the expensive aggregation), fetched
 * independently and merged into the config by {@link mergeUsage}.
 */
export interface TenantProviderUsage {
  provider: string;
  auth_type: AuthType;
  consumption_tokens: number;
  consumption_messages: number;
  consumption_cost: number;
  /** Every provider call over the last 30 days, at THIS row's grain. */
  attempts_30d: number;
  /** Attempts that returned success over the last 30 days. */
  succeeded_30d: number;
  last_used_at: string | null;
  sparkline_7d: number[];
}

/**
 * Config decorated with usage. This is the shape the provider pages render —
 * usage fields are zeroed until the usage fetch resolves (callers track the
 * loading state separately so they can shimmer rather than render a real 0).
 */
export type TenantProviderSummary = TenantProviderConfig & TenantProviderUsage;

export interface ProvidersResponse {
  providers: TenantProviderConfig[];
  model_counts: Record<string, number>;
}

export interface ProviderUsageResponse {
  providers: TenantProviderUsage[];
}

/** Fetch provider CONFIG only (cheap; paints immediately). */
export function getProviders() {
  return fetchJson<ProvidersResponse>('/providers');
}

/** Fetch provider USAGE stats (the expensive 30d aggregation). */
export function getProviderUsage() {
  return fetchJson<ProviderUsageResponse>('/providers/usage');
}

const USAGE_ZERO: Omit<TenantProviderUsage, 'provider' | 'auth_type'> = {
  consumption_tokens: 0,
  consumption_messages: 0,
  consumption_cost: 0,
  attempts_30d: 0,
  succeeded_30d: 0,
  last_used_at: null,
  sparkline_7d: [],
};

/** Key a (provider, auth_type) pair the same way the backend groups them. */
function usageKey(provider: string, authType: string): string {
  return `${provider}::${authType}`;
}

/**
 * Merge a usage list into a config list, keyed by (provider, auth_type). Every
 * config row gets a usage block: its matching usage when present, else zeros.
 * A missing/undefined `usageList` (still loading) yields all-zero usage, so
 * callers can render config now and rely on their own loading flag to decide
 * whether to shimmer the usage cells instead of showing a misleading 0.
 */
export function mergeUsage(
  configList: TenantProviderConfig[],
  usageList: TenantProviderUsage[] | undefined,
): TenantProviderSummary[] {
  const usageByKey = new Map<string, TenantProviderUsage>();
  for (const u of usageList ?? []) usageByKey.set(usageKey(u.provider, u.auth_type), u);

  return configList.map((config) => {
    const usage = usageByKey.get(usageKey(config.provider, config.auth_type));
    return {
      ...config,
      consumption_tokens: usage?.consumption_tokens ?? USAGE_ZERO.consumption_tokens,
      consumption_messages: usage?.consumption_messages ?? USAGE_ZERO.consumption_messages,
      consumption_cost: usage?.consumption_cost ?? USAGE_ZERO.consumption_cost,
      attempts_30d: usage?.attempts_30d ?? USAGE_ZERO.attempts_30d,
      succeeded_30d: usage?.succeeded_30d ?? USAGE_ZERO.succeeded_30d,
      last_used_at: usage?.last_used_at ?? USAGE_ZERO.last_used_at,
      sparkline_7d: usage?.sparkline_7d ?? USAGE_ZERO.sparkline_7d,
    };
  });
}
