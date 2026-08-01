import type { KeyRotationRule } from 'manifest-shared';
import { fetchJson, fetchMutate, routingPath } from './core.js';

export type { KeyRotationRule };

/**
 * Write payload — matches the backend's `KeyRotationRuleDto`. `id` is honored
 * when present (the service upserts by it); `agentId` is never accepted from
 * the client, since the resolved agent from the URL owns every rule in a PUT.
 *
 * A rule is scoped: `'model'` (default) pins an ordered key list to one model,
 * `'provider'` applies it to every model of the provider. Model-scope rules
 * carry a non-null `model`; provider-scope rules send `model: null`.
 */
export interface KeyRotationRuleInput {
  id?: string;
  model: string | null;
  provider: string;
  scope: 'model' | 'provider';
  keyOrder: string[];
}

export function listKeyRules(agentName: string) {
  return fetchJson<{ rules: KeyRotationRule[] }>(routingPath(agentName, 'key-rules'));
}

/** Full-replace save. The backend persists the whole list and returns it. */
export function saveKeyRules(agentName: string, rules: KeyRotationRuleInput[]) {
  return fetchMutate<{ rules: KeyRotationRule[] }>(routingPath(agentName, 'key-rules'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules }),
  });
}
