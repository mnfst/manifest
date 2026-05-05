import { fetchJson, fetchMutate, routingPath } from './core.js';
import type { AuthType, ModelRoute, RequestParamDefaults } from './routing.js';

export interface SpecificityAssignment {
  id: string;
  agent_id: string;
  category: string;
  is_active: boolean;
  override_route: ModelRoute | null;
  auto_assigned_route: ModelRoute | null;
  fallback_routes: ModelRoute[] | null;
  param_defaults: RequestParamDefaults | null;
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
  const body: Record<string, unknown> = { model, provider };
  if (authType) {
    body.authType = authType;
    body.route = { provider, authType, model };
  }
  return fetchMutate<SpecificityAssignment>(
    routingPath(agentName, `specificity/${encodeURIComponent(category)}`),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

export function setSpecificityParamDefaults(
  agentName: string,
  category: string,
  paramDefaults: RequestParamDefaults | null,
) {
  return fetchMutate<SpecificityAssignment>(
    routingPath(agentName, `specificity/${encodeURIComponent(category)}/params`),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paramDefaults }),
    },
  );
}

export function resetSpecificity(agentName: string, category: string) {
  return fetchMutate(routingPath(agentName, `specificity/${encodeURIComponent(category)}`), {
    method: 'DELETE',
  });
}

export function setSpecificityFallbacks(
  agentName: string,
  category: string,
  models: string[],
  routes?: ModelRoute[],
) {
  const body: Record<string, unknown> = { models };
  if (routes && routes.length === models.length) body.routes = routes;
  return fetchMutate<string[]>(
    routingPath(agentName, `specificity/${encodeURIComponent(category)}/fallbacks`),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
