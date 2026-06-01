import { fetchJson, fetchMutate } from './core.js';

export function getProviderAnalytics(
  authType: string,
  range = '24h',
  agentName?: string,
  provider?: string,
) {
  return fetchJson('/provider-analytics', {
    auth_type: authType,
    range,
    ...(agentName ? { agent_name: agentName } : {}),
    ...(provider ? { provider } : {}),
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
): Promise<{ agents: string[]; timeseries: Array<Record<string, number | string>> }> {
  return fetchJson('/provider-analytics/per-agent-timeseries', {
    auth_type: authType,
    provider,
    range,
  }) as Promise<{ agents: string[]; timeseries: Array<Record<string, number | string>> }>;
}

export function getPerAgentMessageTimeseries(
  authType: string,
  provider: string,
  range = '24h',
): Promise<{ agents: string[]; timeseries: Array<Record<string, number | string>> }> {
  return fetchJson('/provider-analytics/per-agent-message-timeseries', {
    auth_type: authType,
    provider,
    range,
  }) as Promise<{ agents: string[]; timeseries: Array<Record<string, number | string>> }>;
}

export function getPerAgentCostTimeseries(
  authType: string,
  provider: string,
  range = '24h',
): Promise<{ agents: string[]; timeseries: Array<Record<string, number | string>> }> {
  return fetchJson('/provider-analytics/per-agent-cost-timeseries', {
    auth_type: authType,
    provider,
    range,
  }) as Promise<{ agents: string[]; timeseries: Array<Record<string, number | string>> }>;
}

export function getConnectionDetail(connectionId: string) {
  return fetchJson('/provider-analytics/connection-detail', { connection_id: connectionId });
}

export function getOverview(range = '24h', agentName?: string) {
  return fetchJson('/overview', { range, ...(agentName ? { agent_name: agentName } : {}) });
}

type PivotedTimeseries = Promise<{
  agents: string[];
  timeseries: Array<Record<string, number | string>>;
}>;

export function getGlobalPerAgentTimeseries(range = '24h'): PivotedTimeseries {
  return fetchJson('/overview/per-agent-timeseries', { range }) as PivotedTimeseries;
}

export function getGlobalPerAgentMessageTimeseries(range = '24h'): PivotedTimeseries {
  return fetchJson('/overview/per-agent-message-timeseries', { range }) as PivotedTimeseries;
}

export function getGlobalPerAgentCostTimeseries(range = '24h'): PivotedTimeseries {
  return fetchJson('/overview/per-agent-cost-timeseries', { range }) as PivotedTimeseries;
}

export function getGlobalPerProviderTimeseries(range = '24h'): PivotedTimeseries {
  return fetchJson('/overview/per-provider-timeseries', { range }) as PivotedTimeseries;
}

export function getGlobalPerProviderMessageTimeseries(range = '24h'): PivotedTimeseries {
  return fetchJson('/overview/per-provider-message-timeseries', { range }) as PivotedTimeseries;
}

export function getGlobalPerModelTimeseries(range = '24h'): PivotedTimeseries {
  return fetchJson('/overview/per-model-timeseries', { range }) as PivotedTimeseries;
}

export function getGlobalPerModelMessageTimeseries(range = '24h'): PivotedTimeseries {
  return fetchJson('/overview/per-model-message-timeseries', { range }) as PivotedTimeseries;
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

export function getHealth() {
  return fetchJson('/health');
}

export function getModelPrices() {
  return fetchJson('/model-prices');
}

export interface SavingsData {
  total_saved: number;
  savings_pct: number;
  actual_cost: number;
  baseline_cost: number;
  baseline_model: {
    id: string;
    display_name: string;
    provider: string;
    input_price_per_token: number;
    output_price_per_token: number;
  } | null;
  baseline_override_stale: boolean;
  request_count: number;
  trend_pct: number;
  is_auto: boolean;
  savings_by_auth_type: {
    api_key: number;
    subscription: number;
    local: number;
  };
}

export interface BaselineCandidateData {
  id: string;
  display_name: string;
  provider: string;
  input_price_per_token: number;
  output_price_per_token: number;
  price_per_million: number;
  is_current: boolean;
}

export function getSavings(
  range: string,
  agentName: string,
  baseline?: string,
): Promise<SavingsData> {
  return fetchJson<SavingsData>('/savings', {
    range,
    agent_name: agentName,
    ...(baseline ? { baseline } : {}),
  });
}

export function getBaselineCandidates(agentName: string): Promise<BaselineCandidateData[]> {
  return fetchJson<BaselineCandidateData[]>('/savings/baseline-candidates', {
    agent_name: agentName,
  });
}

export interface SavingsTimeseriesRow {
  date?: string;
  hour?: string;
  actual_cost: number;
  baseline_cost: number;
}

export function getSavingsTimeseries(
  range: string,
  agentName: string,
): Promise<SavingsTimeseriesRow[]> {
  return fetchJson<SavingsTimeseriesRow[]>('/savings/timeseries', {
    range,
    agent_name: agentName,
  });
}
