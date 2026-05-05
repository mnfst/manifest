/**
 * Provider-by-provider default for the OpenAI-compat `thinking.type` field.
 *
 * The popup needs to know what the upstream provider does *without* an
 * override so it can (a) show the user the real baseline and (b) collapse
 * a chosen value back to `null` when the user lands on the same state as
 * the effective default. The proxy uses the same registry to know whose
 * tier-aware logic to apply.
 *
 * Add a provider here only when its API actually consumes `thinking.type`
 * in chat-completions. Anthropic / Gemini have their own thinking shapes
 * and don't belong on this surface.
 */
export type ThinkingState = 'enabled' | 'disabled';

export const PROVIDER_THINKING_DEFAULTS: Record<string, ThinkingState> = {
  deepseek: 'enabled',
};

export function providerThinkingDefault(providerId: string | undefined): ThinkingState | undefined {
  if (!providerId) return undefined;
  return PROVIDER_THINKING_DEFAULTS[providerId.toLowerCase()];
}

/**
 * Tiers where thinking eats the response budget and Manifest opts to
 * override the provider's "thinking on" default. Reasoning is excluded —
 * that tier exists precisely for problems that need the full chain. The
 * default tier (no complexity routing) is also excluded; without tier
 * semantics to lean on, Manifest stays neutral and lets the provider
 * decide.
 */
const MANIFEST_THINKING_OFF_TIERS: ReadonlySet<string> = new Set(['simple', 'standard', 'complex']);

/**
 * Manifest's opinionated default for `(provider, tier)`. Returns the
 * provider's actual default unless the tier is a speed/cost-oriented
 * complexity tier and the provider's default would otherwise eat budget
 * on reasoning tokens. Used at proxy time to inject a thinking value when
 * the user has not configured a per-assignment override, and on the
 * frontend to display the hint and decide when a chosen value can be
 * collapsed back to `null`.
 */
export function manifestThinkingDefault(
  providerId: string | undefined,
  tier: string | undefined,
): ThinkingState | undefined {
  const base = providerThinkingDefault(providerId);
  if (base !== 'enabled') return base;
  if (tier && MANIFEST_THINKING_OFF_TIERS.has(tier)) return 'disabled';
  return base;
}

/**
 * Wire-shape view of `manifestThinkingDefault` — returns a mergeable
 * `RequestParamDefaults` payload only when Manifest's opinion *differs*
 * from the provider's actual default. Otherwise returns `null` so we
 * don't inject a redundant field that the provider would have applied
 * anyway. Used by the proxy as the lowest-precedence layer in the
 * request body merge.
 */
export function manifestThinkingParamDefaults(
  providerId: string | undefined,
  tier: string | undefined,
): { thinking: { type: ThinkingState } } | null {
  const opinion = manifestThinkingDefault(providerId, tier);
  if (!opinion) return null;
  if (opinion === providerThinkingDefault(providerId)) return null;
  return { thinking: { type: opinion } };
}
