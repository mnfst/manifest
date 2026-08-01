/**
 * Per-agent (harness) key rotation rule.
 *
 * Maps a model string to an ordered list of provider API-key labels. When a
 * route attempts that model (as primary or as any fallback-chain slot) and a
 * rule exists, the rule fully controls which key is used: the first unused
 * label in `keyOrder` wins over any pinned `keyLabel` on the route. Each
 * failure with a fallback-triggering status retries the SAME model with the
 * next unused label; when the order is exhausted the model counts as failed
 * and the chain advances to the next model.
 */
export interface KeyRotationRule {
  id: string;
  agentId: string;
  model: string;
  provider: string;
  keyOrder: string[];
  createdAt?: string;
  updatedAt?: string;
}

export function isKeyRotationRule(value: unknown): value is KeyRotationRule {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.agentId !== 'string') return false;
  if (typeof v.model !== 'string' || typeof v.provider !== 'string') return false;
  if (!Array.isArray(v.keyOrder)) return false;
  if (!v.keyOrder.every((label) => typeof label === 'string')) return false;
  return true;
}

export function isKeyRotationRuleArray(value: unknown): value is KeyRotationRule[] {
  return Array.isArray(value) && value.every(isKeyRotationRule);
}
