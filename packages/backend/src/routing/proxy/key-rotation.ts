import type { KeyRotationRule } from 'manifest-shared';

/**
 * Per-request key rotation state. Maps a rotation state key to the set of key
 * labels already attempted during THIS request. Created once per proxy request
 * and shared between the primary attempt flow (proxy.service), the fallback
 * chain (proxy-fallback.service), and the Auto-fix rotate_key reforward, so a
 * label burned by one hop is never re-tried later in the same request.
 *
 * The state key follows the RULE's scope: a provider-scope rule shares one key
 * across every model of that provider (a hard-failed label must not be retried
 * for another model under the same provider rule), while a model-scope rule
 * keys by the model. See {@link keyRotationStateKey}.
 */
export type KeyRotationState = Map<string, Set<string>>;

export function createKeyRotationState(): KeyRotationState {
  return new Map();
}

/**
 * The state key for a rule+model pair. Provider-scope rules are keyed by the
 * provider so a failed label is not retried across models of the same provider
 * in one request; model-scope rules are keyed by the model as before.
 */
export function keyRotationStateKey(rule: KeyRotationRule, model: string): string {
  return rule.scope === 'provider'
    ? `provider:${rule.provider.toLowerCase()}`
    : `model:${model.toLowerCase()}`;
}

/** Record that `label` was already attempted for `rule`+`model` in this request. */
export function markKeyLabelUsed(
  state: KeyRotationState,
  rule: KeyRotationRule,
  model: string,
  label: string | undefined,
): void {
  if (!label) return;
  const key = keyRotationStateKey(rule, model);
  let used = state.get(key);
  if (!used) {
    used = new Set();
    state.set(key, used);
  }
  used.add(label);
}

/**
 * First label in the rule's order that this request hasn't attempted yet for
 * `model`. Returns undefined when the order is exhausted — the model then
 * counts as failed and the chain advances to the next model.
 */
export function nextUnusedKeyLabel(
  rule: KeyRotationRule,
  state: KeyRotationState,
  model: string,
): string | undefined {
  const used = state.get(keyRotationStateKey(rule, model));
  if (!used) return rule.keyOrder[0];
  for (const label of rule.keyOrder) {
    if (!used.has(label)) return label;
  }
  return undefined;
}

/** Count of labels already attempted for `rule`+`model` (for rotation logging). */
export function usedLabelCount(
  state: KeyRotationState,
  rule: KeyRotationRule,
  model: string,
): number {
  return state.get(keyRotationStateKey(rule, model))?.size ?? 0;
}
