import { fetchJson, fetchMutate, routingPath } from './core.js';
import type { AuthType } from './routing.js';
import type { ProviderParamSpecRegistry, RequestParamDefaults } from 'manifest-shared';
export type { ProviderParamSpecRegistry } from 'manifest-shared';
export {
  modelParamsScopeForTier,
  modelParamsScopeForSpecificity,
  modelParamsScopeForHeaderTier,
} from 'manifest-shared';

/**
 * Per-route saved request body defaults. The frontend fetches the full set
 * once on Routing page boot and indexes by scoped route identity; every
 * model-row affordance reads from that map without per-row fetches.
 */
export interface AgentModelParamsRow {
  scope: string;
  provider: string;
  authType: AuthType;
  model: string;
  params: RequestParamDefaults;
}

export function listModelParams(agentName: string) {
  return fetchJson<AgentModelParamsRow[]>(routingPath(agentName, 'model-params'));
}

export function listModelParamSpecs(agentName: string) {
  return fetchJson<ProviderParamSpecRegistry>(routingPath(agentName, 'model-param-specs'));
}

export function setModelParams(
  agentName: string,
  input: {
    scope: string;
    provider: string;
    authType: AuthType;
    model: string;
    params: RequestParamDefaults;
  },
) {
  return fetchMutate<AgentModelParamsRow>(routingPath(agentName, 'model-params'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function deleteModelParams(
  agentName: string,
  input: { scope: string; provider: string; authType: AuthType; model: string },
) {
  return fetchMutate<{ ok: true }>(routingPath(agentName, 'model-params'), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

/**
 * Stable key for indexing `AgentModelParamsRow[]` in a Map. Scope separates
 * complexity, task-specific, and custom tiers; provider is lowercased so case
 * differences between save and lookup don't break the index.
 */
export function modelParamsKey(
  scope: string,
  provider: string,
  authType: AuthType,
  model: string,
): string {
  return `${scope}::${provider.toLowerCase()}::${model}::${authType}`;
}
