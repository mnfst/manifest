import { fetchJson } from './core.js';

export interface FreeModelDto {
  id: string | null;
  name: string;
  context: string;
  max_output: string;
  modality: string;
  rate_limit: string;
}

export interface FreeProviderDto {
  name: string;
  logo: string | null;
  description: string;
  tags: string[];
  api_key_url: string;
  base_url: string | null;
  warning: string | null;
  country: string;
  flag: string;
  models: FreeModelDto[];
}

export interface FreeModelsResponse {
  providers: FreeProviderDto[];
  last_synced_at: string | null;
}

export function getFreeModels(): Promise<FreeModelsResponse> {
  return fetchJson<FreeModelsResponse>('/free-models');
}
