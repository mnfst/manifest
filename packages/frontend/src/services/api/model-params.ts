import { fetchJson, fetchMutate, routingPath } from './core.js';
import type { AuthType } from './routing.js';
import type { RequestParamDefaults } from 'manifest-shared';

/**
 * Per-route saved request body defaults. The frontend fetches the full set
 * once on Routing page boot and indexes by route identity; every model-row
 * affordance reads from that map without per-row fetches.
 */
export interface AgentModelParamsRow {
  provider: string;
  authType: AuthType;
  model: string;
  params: RequestParamDefaults;
}

export function listModelParams(agentName: string) {
  return fetchJson<AgentModelParamsRow[]>(routingPath(agentName, 'model-params'));
}

export function setModelParams(
  agentName: string,
  input: { provider: string; authType: AuthType; model: string; params: RequestParamDefaults },
) {
  return fetchMutate<AgentModelParamsRow>(routingPath(agentName, 'model-params'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function deleteModelParams(
  agentName: string,
  input: { provider: string; authType: AuthType; model: string },
) {
  return fetchMutate<{ ok: true }>(routingPath(agentName, 'model-params'), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

/**
 * Stable key for indexing `AgentModelParamsRow[]` in a Map. Provider is
 * lowercased so case differences between save and lookup don't break the
 * index — the backend stores provider lowercase too.
 */
export function modelParamsKey(provider: string, authType: AuthType, model: string): string {
  return `${provider.toLowerCase()}::${authType}::${model}`;
}
