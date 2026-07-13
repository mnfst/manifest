import { fetchJson } from './core.js';

export type PivotedTimeseries = Promise<{
  agents: string[];
  timeseries: Array<Record<string, number | string>>;
}>;

export type UsageTimeseries = Promise<{
  tokenUsage: Awaited<PivotedTimeseries>;
  messageUsage: Awaited<PivotedTimeseries>;
  costUsage: Awaited<PivotedTimeseries>;
}>;

export function getProviderAnalytics(
  authType: string,
  range = '24h',
  agentName?: string,
  provider?: string,
  label?: string,
  // The exact connection (tenant_providers id). When set, the backend scopes the
  // summary cards + chart to this key instead of the provider/auth/label tuple.
  connectionId?: string,
) {
  return fetchJson('/provider-analytics', {
    auth_type: authType,
    range,
    ...(agentName ? { agent_name: agentName } : {}),
    ...(provider ? { provider } : {}),
    ...(label !== undefined ? { label } : {}),
    ...(connectionId ? { connection_id: connectionId } : {}),
  });
}

export function getProviderAnalyticsAgents(authType: string): Promise<{ agents: string[] }> {
  return fetchJson('/provider-analytics/agents', { auth_type: authType }) as Promise<{
    agents: string[];
  }>;
}

export function getPerAgentTimeseries(
  authType: string,
  provider: string,
  range = '24h',
  label?: string,
  connectionId?: string,
): PivotedTimeseries {
  return fetchJson('/provider-analytics/per-agent-timeseries', {
    auth_type: authType,
    provider,
    range,
    ...(label !== undefined ? { label } : {}),
    ...(connectionId ? { connection_id: connectionId } : {}),
  }) as PivotedTimeseries;
}

export function getPerAgentMessageTimeseries(
  authType: string,
  provider: string,
  range = '24h',
  label?: string,
  connectionId?: string,
): PivotedTimeseries {
  return fetchJson('/provider-analytics/per-agent-message-timeseries', {
    auth_type: authType,
    provider,
    range,
    ...(label !== undefined ? { label } : {}),
    ...(connectionId ? { connection_id: connectionId } : {}),
  }) as PivotedTimeseries;
}

export function getPerAgentCostTimeseries(
  authType: string,
  provider: string,
  range = '24h',
  label?: string,
  connectionId?: string,
): PivotedTimeseries {
  return fetchJson('/provider-analytics/per-agent-cost-timeseries', {
    auth_type: authType,
    provider,
    range,
    ...(label !== undefined ? { label } : {}),
    ...(connectionId ? { connection_id: connectionId } : {}),
  }) as PivotedTimeseries;
}

export function getConnectionDetail(connectionId: string) {
  return fetchJson('/provider-analytics/connection-detail', { connection_id: connectionId });
}

export function getGlobalPerAgentTimeseries(range = '24h'): PivotedTimeseries {
  return fetchJson('/overview/per-agent-timeseries', { range }) as PivotedTimeseries;
}

export function getGlobalPerAgentMessageTimeseries(range = '24h'): PivotedTimeseries {
  return fetchJson('/overview/per-agent-message-timeseries', { range }) as PivotedTimeseries;
}

export function getGlobalPerAgentCostTimeseries(range = '24h'): PivotedTimeseries {
  return fetchJson('/overview/per-agent-cost-timeseries', { range }) as PivotedTimeseries;
}

export function getOverviewAgentUsage(range = '24h'): UsageTimeseries {
  return fetchJson('/overview/agents/usage', { range }) as UsageTimeseries;
}

export function getGlobalPerProviderTimeseries(range = '24h'): PivotedTimeseries {
  return fetchJson('/overview/per-provider-timeseries', { range }) as PivotedTimeseries;
}

export function getGlobalPerProviderMessageTimeseries(range = '24h'): PivotedTimeseries {
  return fetchJson('/overview/per-provider-message-timeseries', { range }) as PivotedTimeseries;
}

export function getGlobalPerProviderCostTimeseries(range = '24h'): PivotedTimeseries {
  return fetchJson('/overview/per-provider-cost-timeseries', { range }) as PivotedTimeseries;
}

export function getOverviewProviderUsage(range = '24h'): UsageTimeseries {
  return fetchJson('/overview/providers/usage', { range }) as UsageTimeseries;
}

export function getGlobalPerModelTimeseries(range = '24h'): PivotedTimeseries {
  return fetchJson('/overview/per-model-timeseries', { range }) as PivotedTimeseries;
}

export function getGlobalPerModelMessageTimeseries(range = '24h'): PivotedTimeseries {
  return fetchJson('/overview/per-model-message-timeseries', { range }) as PivotedTimeseries;
}

export function getGlobalPerModelCostTimeseries(range = '24h'): PivotedTimeseries {
  return fetchJson('/overview/per-model-cost-timeseries', { range }) as PivotedTimeseries;
}

export function getPerProviderTimeseries(agentName: string, range = '24h'): PivotedTimeseries {
  return fetchJson('/overview/per-provider-timeseries', {
    agent_name: agentName,
    range,
  }) as PivotedTimeseries;
}

export function getPerProviderMessageTimeseries(
  agentName: string,
  range = '24h',
): PivotedTimeseries {
  return fetchJson('/overview/per-provider-message-timeseries', {
    agent_name: agentName,
    range,
  }) as PivotedTimeseries;
}

export function getPerProviderCostTimeseries(agentName: string, range = '24h'): PivotedTimeseries {
  return fetchJson('/overview/per-provider-cost-timeseries', {
    agent_name: agentName,
    range,
  }) as PivotedTimeseries;
}

export function getOverview(range = '24h', agentName?: string) {
  return fetchJson('/overview', { range, ...(agentName ? { agent_name: agentName } : {}) });
}

/** Response shape of `GET /api/v1/errors/breakdown`. Mirrors the backend `ErrorBreakdownResponse`. */
export interface ErrorBreakdownResponse {
  range: string;
  /** Real (successful) messages in the window — the provider-error-rate denominator. */
  successful: number;
  /** All classified error rows (every origin). */
  total_errors: number;
  /** Errors a provider actually threw (the reliability signal). */
  provider_errors: number;
  /** Network/timeout failures reaching a provider. */
  transport_errors: number;
  /** Manifest's OWN config/policy/internal rejections — NOT a provider failure. */
  manifest_errors: number;
  /**
   * Requests healed by Auto-fix — one per healed request. NOT additive with
   * `total_errors`: the healed original is a superseded attempt already counted
   * there, so read this as "of those errors, this many were auto-fixed".
   */
  auto_fixed: number;
  by_origin: Record<string, number>;
  by_class: Record<string, number>;
  /** provider_errors / (provider_errors + successful), 0..1. */
  provider_error_rate: number;
}

/**
 * Error + Auto-fix breakdown for the window. `range` is one of the standard
 * analytics presets (1h/6h/24h/7d/30d/90d/365d); pass the page's range signal.
 */
export function getErrorBreakdown(
  range = '24h',
  agentName?: string,
): Promise<ErrorBreakdownResponse> {
  return fetchJson('/errors/breakdown', {
    range,
    ...(agentName ? { agent_name: agentName } : {}),
  }) as Promise<ErrorBreakdownResponse>;
}

export function getHealth() {
  return fetchJson('/health');
}

export function getModelPrices() {
  return fetchJson('/model-prices');
}
