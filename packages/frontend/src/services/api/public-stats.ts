import { BASE_URL } from './core.js';

export interface DailyTokenEntry {
  date: string;
  tokens: number;
}

export interface ModelBreakdown {
  model: string;
  auth_type: string | null;
  total_tokens: number;
  total_cost: number | null;
  daily: DailyTokenEntry[];
}

export interface ProviderDailyTokens {
  provider: string;
  total_tokens: number;
  models: ModelBreakdown[];
}

export interface ProviderTokensResponse {
  providers: ProviderDailyTokens[];
  cached_at: string;
}

export async function getProviderTokens(): Promise<ProviderTokensResponse> {
  const res = await fetch(`${BASE_URL}/public/provider-tokens`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<ProviderTokensResponse>;
}
