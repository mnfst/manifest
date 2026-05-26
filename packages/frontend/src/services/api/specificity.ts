import { fetchJson, fetchMutate, routingPath } from './core.js';
import type { AuthType, ModelRoute, ResponseMode, OutputModality } from './routing.js';

export interface SpecificityAssignment {
  id: string;
  agent_id: string;
  category: string;
  is_active: boolean;
  override_route: ModelRoute | null;
  auto_assigned_route: ModelRoute | null;
  fallback_routes: ModelRoute[] | null;
  output_modality?: OutputModality;
  response_mode?: ResponseMode;
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
  providerKeyLabel?: string,
) {
  const body: Record<string, unknown> = { model, provider };
  if (authType) {
    body.authType = authType;
    const route: ModelRoute = providerKeyLabel
      ? { provider, authType, model, keyLabel: providerKeyLabel }
      : { provider, authType, model };
    body.route = route;
  }
  if (providerKeyLabel) body.providerKeyLabel = providerKeyLabel;
  return fetchMutate<SpecificityAssignment>(
    routingPath(agentName, `specificity/${encodeURIComponent(category)}`),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

export function resetSpecificity(agentName: string, category: string) {
  return fetchMutate(routingPath(agentName, `specificity/${encodeURIComponent(category)}`), {
    method: 'DELETE',
  });
}

export function setSpecificityResponseMode(
  agentName: string,
  category: string,
  responseMode: ResponseMode,
) {
  return fetchMutate<SpecificityAssignment>(
    routingPath(agentName, `specificity/${encodeURIComponent(category)}/response-mode`),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response_mode: responseMode }),
    },
  );
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
