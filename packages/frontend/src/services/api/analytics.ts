import { fetchJson, fetchMutate } from './core.js';

export function getOverview(range = '24h', agentName?: string) {
  return fetchJson('/overview', { range, ...(agentName ? { agent_name: agentName } : {}) });
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
