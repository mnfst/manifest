/**
 * Per-agent (harness) key rotation rule.
 *
 * Maps a model (or, at `provider` scope, every model of a provider) to an
 * ordered list of provider API-key labels. When a route attempts a model and
 * a rule exists, the rule fully controls which key is used: the first unused
 * label in `keyOrder` wins over any pinned `keyLabel` on the route. Each
 * failure with a fallback-triggering status retries the SAME model with the
 * next unused label; when the order is exhausted the model counts as failed
 * and the chain advances to the next model.
 *
 * Precedence: a `model`-scope rule wins for its model; otherwise a
 * `provider`-scope rule for the model's provider applies; otherwise the
 * route's current behavior (pinned key / default key, no rotation).
 */
export type KeyRotationRuleScope = 'model' | 'provider';

export interface KeyRotationRule {
  id: string;
  agentId: string;
  /** Runtime model identity for `model` scope; `null` for `provider` scope. */
  model: string | null;
  provider: string;
  scope: KeyRotationRuleScope;
  keyOrder: string[];
  createdAt?: string;
  updatedAt?: string;
}

export function isKeyRotationRule(value: unknown): value is KeyRotationRule {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.agentId !== 'string') return false;
  if (v.model !== null && typeof v.model !== 'string') return false;
  if (typeof v.provider !== 'string') return false;
  if (v.scope !== undefined && v.scope !== 'model' && v.scope !== 'provider') return false;
  if (!Array.isArray(v.keyOrder)) return false;
  if (!v.keyOrder.every((label) => typeof label === 'string')) return false;
  return true;
}

export function isKeyRotationRuleArray(value: unknown): value is KeyRotationRule[] {
  return Array.isArray(value) && value.every(isKeyRotationRule);
}
