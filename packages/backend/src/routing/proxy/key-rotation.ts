import type { KeyRotationRule } from 'manifest-shared';

/**
 * Per-request key rotation state. Maps a lowercased model to the set of
 * key labels already attempted for it during THIS request. Created once per
 * proxy request and shared between the primary attempt flow (proxy.service)
 * and the fallback chain (proxy-fallback.service) so a label burned by the
 * primary is never re-tried as a fallback for the same model.
 */
export type KeyRotationState = Map<string, Set<string>>;

export function createKeyRotationState(): KeyRotationState {
  return new Map();
}

/** Record that `label` was already attempted for `model` in this request. */
export function markKeyLabelUsed(
  state: KeyRotationState,
  model: string,
  label: string | undefined,
): void {
  if (!label) return;
  const key = model.toLowerCase();
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
  const used = state.get(model.toLowerCase());
  if (!used) return rule.keyOrder[0];
  for (const label of rule.keyOrder) {
    if (!used.has(label)) return label;
  }
  return undefined;
}

/** Count of labels already attempted for `model` (for rotation logging). */
export function usedLabelCount(state: KeyRotationState, model: string): number {
  return state.get(model.toLowerCase())?.size ?? 0;
}
