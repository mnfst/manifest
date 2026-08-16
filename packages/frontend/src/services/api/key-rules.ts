import type { KeyRotationRule } from 'manifest-shared';
import { fetchJson, fetchMutate, routingPath } from './core.js';

export type { KeyRotationRule };

/**
 * Write payload — matches the backend's `KeyRotationRuleDto` minus `id`.
 * `id` is a local-only handle used for optimistic list updates and is STRIPPED
 * before the PUT: the backend never accepts it (the validation pipe rejects
 * unknown fields with `forbidNonWhitelisted`) and the full-replace upsert
 * diffs by (agent_id, model) / (agent_id, provider) while generating fresh
 * ids. `agentId` is never accepted either — the resolved agent from the URL
 * owns every rule in a PUT.
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
  // The backend's `KeyRotationRuleDto` declares no `id`, and the global
  // ValidationPipe runs forbidNonWhitelisted — sending the local optimistic
  // `id` (a client-generated uuid for new rules) fails the whole PUT with
  // "rules.N.property id should not exist". Strip it here so the wire payload
  // is exactly the DTO shape.
  const payload = rules.map((r) => ({
    model: r.model,
    provider: r.provider,
    scope: r.scope,
    keyOrder: r.keyOrder,
  }));
  return fetchMutate<{ rules: KeyRotationRule[] }>(routingPath(agentName, 'key-rules'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules: payload }),
  });
}
