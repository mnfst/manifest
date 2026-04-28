import { fetchJson, fetchMutate, routingPath } from './core.js';
import type { AuthType } from './routing.js';

export interface SpecificityAssignment {
  id: string;
  agent_id: string;
  category: string;
  is_active: boolean;
  override_model: string | null;
  override_provider: string | null;
  override_auth_type: AuthType | null;
  auto_assigned_model: string | null;
  fallback_models: string[] | null;
  updated_at: string;
}

export function getSpecificityAssignments(agentName: string) {
  return fetchJson<SpecificityAssignment[]>(routingPath(agentName, 'specificity'));
}

export function toggleSpecificity(agentName: string, category: string, active: boolean) {
  return fetchMutate<SpecificityAssignment>(
    routingPath(agentName, `specificity/${encodeURIComponent(category)}/toggle`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    },
  );
}

export function overrideSpecificity(
  agentName: string,
  category: string,
  model: string,
  provider: string,
  authType?: AuthType,
) {
  return fetchMutate<SpecificityAssignment>(
    routingPath(agentName, `specificity/${encodeURIComponent(category)}`),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, provider, ...(authType && { authType }) }),
    },
  );
}

export function resetSpecificity(agentName: string, category: string) {
  return fetchMutate(routingPath(agentName, `specificity/${encodeURIComponent(category)}`), {
    method: 'DELETE',
  });
}

export function setSpecificityFallbacks(agentName: string, category: string, models: string[]) {
  return fetchMutate<string[]>(
    routingPath(agentName, `specificity/${encodeURIComponent(category)}/fallbacks`),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ models }),
    },
  );
}

export function clearSpecificityFallbacks(agentName: string, category: string) {
  return fetchMutate(
    routingPath(agentName, `specificity/${encodeURIComponent(category)}/fallbacks`),
    { method: 'DELETE' },
  );
}

export function resetAllSpecificity(agentName: string) {
  return fetchMutate(routingPath(agentName, 'specificity/reset-all'), {
    method: 'POST',
  });
}
