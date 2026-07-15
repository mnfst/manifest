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

export interface AttemptMetric {
  value: number;
  previous: number;
}

export interface AttemptStats {
  /** All rows in `provider_attempts`. */
  total_attempts: AttemptMetric;
  /** Attempts whose `fallback_from_model` is non-null. */
  fallbacked_attempts: AttemptMetric;
}

export interface AttemptTimeseries {
  range: string;
  by: 'metric';
  keys: string[];
  buckets: Array<{ bucket: string; counts: number[] }>;
}

export function getAttemptStats(range = '7d', agentName?: string): Promise<AttemptStats> {
  return fetchJson('/overview/attempt-stats', {
    range,
    ...(agentName ? { agent_name: agentName } : {}),
  }) as Promise<AttemptStats>;
}

export function getAttemptTimeseries(range = '7d', agentName?: string): Promise<AttemptTimeseries> {
  return fetchJson('/overview/attempt-timeseries', {
    range,
    ...(agentName ? { agent_name: agentName } : {}),
  }) as Promise<AttemptTimeseries>;
}

export function getHealth() {
  return fetchJson('/health');
}

export function getModelPrices() {
  return fetchJson('/model-prices');
}
