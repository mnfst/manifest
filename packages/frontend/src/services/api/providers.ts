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

export interface TenantProviderSummary {
  provider: string;
  auth_type: AuthType;
  connection_count: number;
  connections: TenantProviderConnection[];
  total_models: number;
  consumption_tokens: number;
  consumption_messages: number;
  consumption_cost: number;
  last_used_at: string | null;
  sparkline_7d: number[];
}

export interface ProvidersResponse {
  providers: TenantProviderSummary[];
  model_counts: Record<string, number>;
}

export function getProviders() {
  return fetchJson<ProvidersResponse>('/providers');
}
