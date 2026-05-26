import { fetchJson, fetchMutate, routingPath } from './core.js';
import type { AuthType } from './routing.js';
import type { ProviderParamSpec, RequestParamDefaults } from 'manifest-shared';

export type { ProviderParamSpec } from 'manifest-shared';

/**
 * Per-route saved request body defaults. The frontend fetches the full set
 * once on Routing page boot and indexes by route identity; every model-row
 * affordance reads from that map without per-row fetches.
 */
export interface AgentModelParamsRow {
  scope: string;
  provider: string;
  authType: AuthType;
  model: string;
  params: RequestParamDefaults;
}

/**
 * Specs for a single route, fetched on demand when the user opens that model's
 * parameter dialog. Replaces a full-catalog download on Routing-page boot, so
 * the payload stays flat (~1 model) as the MPS catalog grows. Returns `[]` when
 * the model has no configurable parameters.
 */
export function getModelParamSpecs(
  agentName: string,
  provider: string,
  authType: AuthType,
  model: string,
) {
  return fetchJson<ProviderParamSpec[]>(routingPath(agentName, 'model-param-specs/by-model'), {
    provider,
    authType,
    model,
  });
}

/** Route identity of a model that has configurable params (no param metadata). */
export interface ModelParamSpecId {
  provider: string;
  authType: AuthType;
  model: string;
}

/**
 * Lightweight identities of every model that has configurable specs. Loaded
 * once on Routing page boot so each row can decide whether to show the params
 * affordance — far cheaper than the full catalog since it omits param details.
 */
export function listModelParamSpecIndex(agentName: string) {
  return fetchJson<ModelParamSpecId[]>(routingPath(agentName, 'model-param-specs/index'));
}

export function listModelParams(agentName: string) {
  return fetchJson<AgentModelParamsRow[]>(routingPath(agentName, 'model-params'));
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
