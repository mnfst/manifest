import { fetchJson, fetchMutate, routingPath } from './core.js';
import type { AuthType } from './routing.js';
import type { TierColor } from 'manifest-shared';

export interface HeaderTier {
  id: string;
  agent_id: string;
  name: string;
  header_key: string;
  header_value: string;
  badge_color: TierColor;
  sort_order: number;
  enabled: boolean;
  override_model: string | null;
  override_provider: string | null;
  override_auth_type: AuthType | null;
  fallback_models: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface SeenHeader {
  key: string;
  count: number;
  top_values: string[];
  sdks: string[];
}

export interface CreateHeaderTierInput {
  name: string;
  header_key: string;
  header_value: string;
  badge_color: TierColor;
}

export function listHeaderTiers(agentName: string) {
  return fetchJson<HeaderTier[]>(routingPath(agentName, 'header-tiers'));
}

export function getSeenHeaders(agentName: string, scope?: 'all' | 'agent') {
  const qs = scope === 'all' ? '?scope=all' : '';
  return fetchJson<SeenHeader[]>(routingPath(agentName, `seen-headers${qs}`));
}

export function createHeaderTier(agentName: string, input: CreateHeaderTierInput) {
  return fetchMutate<HeaderTier>(routingPath(agentName, 'header-tiers'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateHeaderTier(
  agentName: string,
  id: string,
  patch: Partial<CreateHeaderTierInput>,
) {
  return fetchMutate<HeaderTier>(routingPath(agentName, `header-tiers/${encodeURIComponent(id)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function toggleHeaderTier(agentName: string, id: string, enabled: boolean) {
  return fetchMutate<HeaderTier>(
    routingPath(agentName, `header-tiers/${encodeURIComponent(id)}/toggle`),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    },
  );
}

export function deleteHeaderTier(agentName: string, id: string) {
  return fetchMutate(routingPath(agentName, `header-tiers/${encodeURIComponent(id)}`), {
    method: 'DELETE',
  });
}

export function reorderHeaderTiers(agentName: string, ids: string[]) {
  return fetchMutate(routingPath(agentName, 'header-tiers/reorder'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
}

export function overrideHeaderTier(
  agentName: string,
  id: string,
  model: string,
  provider: string,
  authType?: AuthType,
) {
  return fetchMutate<HeaderTier>(
    routingPath(agentName, `header-tiers/${encodeURIComponent(id)}/override`),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, provider, ...(authType && { authType }) }),
    },
  );
}

export function resetHeaderTier(agentName: string, id: string) {
  return fetchMutate(routingPath(agentName, `header-tiers/${encodeURIComponent(id)}/override`), {
    method: 'DELETE',
  });
}

export function setHeaderTierFallbacks(agentName: string, id: string, models: string[]) {
  return fetchMutate<string[]>(
    routingPath(agentName, `header-tiers/${encodeURIComponent(id)}/fallbacks`),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ models }),
    },
  );
}

export function clearHeaderTierFallbacks(agentName: string, id: string) {
  return fetchMutate(routingPath(agentName, `header-tiers/${encodeURIComponent(id)}/fallbacks`), {
    method: 'DELETE',
  });
}
