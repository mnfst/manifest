import type { AuthType } from 'manifest-shared';
import { BASE_URL, fetchJson, fetchMutate, parseErrorMessage, routingPath } from './core.js';

export type { AuthType };

export interface RoutingProvider {
  id: string;
  provider: string;
  auth_type: AuthType;
  is_active: boolean;
  has_api_key: boolean;
  key_prefix?: string | null;
  region?: string | null;
  connected_at: string;
}

/* -- Routing: Status -- */

export type RoutingStatusReason =
  | 'no_provider'
  | 'no_routable_models'
  | 'pricing_cache_empty'
  | null;

export interface RoutingStatus {
  enabled: boolean;
  reason: RoutingStatusReason;
}

export function getRoutingStatus(agentName: string) {
  return fetchJson<RoutingStatus>(routingPath(agentName, 'status'));
}

/* -- Routing: Providers -- */

export function getProviders(agentName: string) {
  return fetchJson<RoutingProvider[]>(routingPath(agentName, 'providers'));
}

export function connectProvider(
  agentName: string,
  data: { provider: string; apiKey?: string; authType?: AuthType },
) {
  return fetchMutate<{
    id: string;
    provider: string;
    auth_type: AuthType;
    is_active: boolean;
    region?: string | null;
  }>(routingPath(agentName, 'providers'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function disconnectProvider(agentName: string, provider: string, authType?: AuthType) {
  const base = routingPath(agentName, `providers/${encodeURIComponent(provider)}`);
  const path = authType ? `${base}?authType=${authType}` : base;
  return fetchMutate<{ ok: boolean; notifications: string[] }>(path, { method: 'DELETE' });
}

/* -- Routing: Copilot Device Login -- */

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export type CopilotPollStatus = 'pending' | 'complete' | 'expired' | 'denied' | 'slow_down';

export function copilotDeviceCode(agentName: string) {
  return fetchMutate<DeviceCodeResponse>(routingPath(agentName, 'copilot/device-code'), {
    method: 'POST',
  });
}

export async function copilotPollToken(agentName: string, deviceCode: string) {
  const res = await fetch(`/api/v1${routingPath(agentName, 'copilot/poll-token')}`, {
    credentials: 'include',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceCode }),
  });
  if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
  return res.json() as Promise<{ status: CopilotPollStatus }>;
}

/* -- Routing: Complexity Toggle -- */

export interface ComplexityStatus {
  enabled: boolean;
}

export function getComplexityStatus(agentName: string) {
  return fetchJson<ComplexityStatus>(routingPath(agentName, 'complexity/status'));
}

export function toggleComplexity(agentName: string) {
  return fetchMutate<ComplexityStatus>(routingPath(agentName, 'complexity/toggle'), {
    method: 'POST',
  });
}

/* -- Routing: Tier Assignments -- */

export interface TierAssignment {
  id: string;
  agent_id: string;
  tier: string;
  override_model: string | null;
  override_provider: string | null;
  override_auth_type: AuthType | null;
  auto_assigned_model: string | null;
  fallback_models: string[] | null;
  updated_at: string;
}

export function getTierAssignments(agentName: string) {
  return fetchJson<TierAssignment[]>(routingPath(agentName, 'tiers'));
}

export function overrideTier(
  agentName: string,
  tier: string,
  model: string,
  provider: string,
  authType?: AuthType,
) {
  return fetchMutate<TierAssignment>(routingPath(agentName, `tiers/${encodeURIComponent(tier)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, provider, ...(authType && { authType }) }),
  });
}

export function resetTier(agentName: string, tier: string) {
  return fetchMutate(routingPath(agentName, `tiers/${encodeURIComponent(tier)}`), {
    method: 'DELETE',
  });
}

export function resetAllTiers(agentName: string) {
  return fetchMutate(routingPath(agentName, 'tiers/reset-all'), { method: 'POST' });
}

/* -- Routing: Fallbacks -- */

export function getFallbacks(agentName: string, tier: string) {
  return fetchJson<string[]>(routingPath(agentName, `tiers/${encodeURIComponent(tier)}/fallbacks`));
}

export function setFallbacks(agentName: string, tier: string, models: string[]) {
  return fetchMutate<string[]>(
    routingPath(agentName, `tiers/${encodeURIComponent(tier)}/fallbacks`),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ models }),
    },
  );
}

export function clearFallbacks(agentName: string, tier: string) {
  return fetchMutate(routingPath(agentName, `tiers/${encodeURIComponent(tier)}/fallbacks`), {
    method: 'DELETE',
  });
}

/* -- Routing: Available Models -- */

export interface AvailableModel {
  model_name: string;
  provider: string;
  auth_type?: AuthType;
  input_price_per_token: number | null;
  output_price_per_token: number | null;
  context_window: number;
  capability_reasoning: boolean;
  capability_code: boolean;
  quality_score: number;
  display_name?: string;
  provider_display_name?: string;
}

export function getAvailableModels(agentName: string) {
  return fetchJson<AvailableModel[]>(routingPath(agentName, 'available-models'));
}

export function refreshModels(agentName: string) {
  return fetchMutate<{ ok: boolean }>(routingPath(agentName, 'refresh-models'), {
    method: 'POST',
  });
}

/* -- Routing: Pricing cache health -- */

export interface PricingHealth {
  model_count: number;
  last_fetched_at: string | null;
}

export function getPricingHealth() {
  return fetchJson<PricingHealth>('/routing/pricing-health');
}

export function refreshPricing() {
  return fetchMutate<{ ok: boolean; model_count: number; last_fetched_at: string | null }>(
    '/routing/pricing/refresh',
    { method: 'POST' },
  );
}

/* -- Routing: Custom Providers -- */

export interface CustomProviderModel {
  model_name: string;
  input_price_per_million_tokens?: number;
  output_price_per_million_tokens?: number;
  context_window?: number;
}

export interface CustomProviderData {
  id: string;
  name: string;
  base_url: string;
  has_api_key: boolean;
  models: CustomProviderModel[];
  created_at: string;
}

export function getCustomProviders(agentName: string) {
  return fetchJson<CustomProviderData[]>(routingPath(agentName, 'custom-providers'));
}

export function createCustomProvider(
  agentName: string,
  data: {
    name: string;
    base_url: string;
    apiKey?: string;
    models: CustomProviderModel[];
  },
) {
  return fetchMutate<CustomProviderData>(routingPath(agentName, 'custom-providers'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateCustomProvider(
  agentName: string,
  id: string,
  data: {
    name?: string;
    base_url?: string;
    apiKey?: string;
    models?: CustomProviderModel[];
  },
) {
  return fetchMutate<CustomProviderData>(
    routingPath(agentName, `custom-providers/${encodeURIComponent(id)}`),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
}

export async function probeCustomProvider(agentName: string, base_url: string, apiKey?: string) {
  const res = await fetch(`${BASE_URL}${routingPath(agentName, 'custom-providers/probe')}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_url, apiKey }),
  });
  if (!res.ok) {
    const message = await parseErrorMessage(res);
    throw new Error(message);
  }
  const text = await res.text();
  if (!text) return { models: [] } as { models: { model_name: string }[] };
  return JSON.parse(text) as { models: { model_name: string }[] };
}

export function deleteCustomProvider(agentName: string, id: string) {
  return fetchMutate<{ ok: boolean }>(
    routingPath(agentName, `custom-providers/${encodeURIComponent(id)}`),
    { method: 'DELETE' },
  );
}
