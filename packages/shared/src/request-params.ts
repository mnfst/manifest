/**
 * Per-assignment defaults that get merged into the outbound request body
 * before it is sent to the LLM provider. Currently only `thinking` is
 * supported — DeepSeek's thinking-mode toggle. New provider knobs
 * (reasoning_effort, safety settings, etc.) get added here explicitly as
 * their UI lands, rather than as a free-form bag, so the surface stays
 * curated.
 *
 * Precedence is presence-based, not truthy: if the inbound request body
 * contains the key — even with `null` — the client wins. Otherwise the
 * configured default is injected. If neither is set, the provider's own
 * default applies.
 */
export interface RequestParamDefaults {
  thinking?: { type: 'enabled' | 'disabled' };
}

/**
 * Merge configured defaults into a request body. Body keys win over
 * defaults by presence (not truthiness), so a client that explicitly sends
 * `{ thinking: null }` keeps that null.
 */
export function applyRequestParamDefaults<T extends Record<string, unknown>>(
  body: T,
  defaults: RequestParamDefaults | null | undefined,
): T {
  if (!defaults) return body;
  return { ...defaults, ...body } as T;
}
