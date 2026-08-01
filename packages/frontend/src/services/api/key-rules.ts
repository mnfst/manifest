import type { KeyRotationRule } from 'manifest-shared';
import { fetchJson, fetchMutate, routingPath } from './core.js';

export type { KeyRotationRule };

/**
 * Write payload — matches the backend's `KeyRotationRuleDto`. `id` is honored
 * when present (the service upserts by it); `agentId` is never accepted from
 * the client, since the resolved agent from the URL owns every rule in a PUT.
 */
export interface KeyRotationRuleInput {
  id?: string;
  model: string;
  provider: string;
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
