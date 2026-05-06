import {
  REQUEST_PARAM_KEYS,
  applyRequestParamDefaults,
  type RequestParamDefaults,
} from './request-params';
import {
  filterParamDefaultsForProvider,
  manifestThinkingParamDefaults,
  providerThinkingDefault,
} from './thinking-defaults';

/**
 * The snapshot of which request body parameters were *effectively in play*
 * for a given proxy attempt — the union of:
 *
 * 1. Whatever known param keys the client sent in their body (top precedence
 *    by presence — including explicit `null`).
 * 2. The user's stored `param_defaults` for the resolved tier/specificity
 *    slot, filtered for the provider that actually received the request.
 * 3. Manifest's tier-aware default (today: thinking-off on DeepSeek for
 *    speed/cost tiers), unless the slot is a specificity match.
 *
 * Recorded per-message on `agent_messages.request_params` so the dashboard
 * can show "this request had thinking=disabled" alongside Request Headers
 * in the expanded row. Returns `null` when no known params are present —
 * the UI hides the accordion in that case to avoid noise.
 *
 * Forward-compatibility: append new param keys to `REQUEST_PARAM_KEYS` in
 * `request-params.ts`. The JSONB column accepts any shape, so future custom
 * provider knobs land here without a migration.
 */
export interface RequestParamsSnapshotInput {
  /** The inbound (pre-merge) client request body. */
  body: Record<string, unknown>;
  /** User-configured per-tier or per-specificity defaults — pre-filter. */
  userDefaults: RequestParamDefaults | null | undefined;
  /** Tier slot the request resolved to (drives Manifest's tier-aware default). */
  tier: string | undefined;
  /** True when the resolved slot is a specificity category, not a tier. */
  isSpecificity: boolean;
  /** The provider that actually received (or will receive) the request. */
  provider: string;
}

export function snapshotRequestParams(
  input: RequestParamsSnapshotInput,
): RequestParamDefaults | null {
  const { body, userDefaults, tier, isSpecificity, provider } = input;

  const compatibleUser = filterParamDefaultsForProvider(userDefaults, provider);
  const manifestDefaults = isSpecificity ? null : manifestThinkingParamDefaults(provider, tier);

  const merged = applyRequestParamDefaults(
    applyRequestParamDefaults(body, compatibleUser),
    manifestDefaults,
  );

  // Casting through `unknown` keeps TS honest about the runtime fact:
  // we're filtering to keys we know are part of `RequestParamDefaults`.
  // The result satisfies the interface even though the source `merged`
  // body is wider.
  const out: Record<string, unknown> = {};
  for (const key of REQUEST_PARAM_KEYS) {
    if (key in merged) {
      out[key] = merged[key];
      continue;
    }
    // No override or Manifest default touched this key for this request,
    // but the provider may still consume it with its own default value
    // (DeepSeek's `thinking` defaults to enabled, for example). Record
    // that effective state so the dashboard can answer "what did this
    // specific request actually have?" without the user having to know
    // the provider's silent defaults — and so two requests with different
    // configured states render distinguishably even when one of them is
    // configured to match the provider's own default.
    if (key === 'thinking') {
      const providerDefault = providerThinkingDefault(provider);
      if (providerDefault !== undefined) {
        out.thinking = { type: providerDefault };
      }
    }
  }
  return Object.keys(out).length > 0 ? (out as unknown as RequestParamDefaults) : null;
}
