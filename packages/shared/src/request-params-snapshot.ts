import {
  REQUEST_PARAM_KEYS,
  applyRequestParamDefaults,
  type RequestParamDefaults,
} from './request-params';
import { providerThinkingDefault } from './thinking-defaults';

/**
 * The snapshot of which request body parameters were *effectively in play*
 * for a given proxy attempt — the union of:
 *
 * 1. Whatever known param keys the client sent in their body (top precedence
 *    by presence — including explicit `null`).
 * 2. The user's stored params for this attempt's (provider, auth_type,
 *    model) tuple, looked up from the per-route `agent_model_params` table.
 * 3. The provider's natural API default (today: DeepSeek's `thinking`
 *    defaults to `enabled`) so a request where neither the client nor the
 *    user configured anything still records the truth of what the provider
 *    will actually do.
 *
 * Recorded per-message on `agent_messages.request_params` so the dashboard
 * can show "this request had thinking=disabled" alongside Request Headers
 * in the expanded row. Returns `null` when no known params are present —
 * the UI hides the accordion in that case to avoid noise.
 *
 * Forward-compatibility: append new param keys to `REQUEST_PARAM_KEYS` in
 * `request-params.ts` and add a per-key fallthrough in this function so
 * the snapshot records the provider's natural default for that key.
 */
export interface RequestParamsSnapshotInput {
  /** The inbound (pre-merge) client request body. */
  body: Record<string, unknown>;
  /**
   * Saved per-route params for the attempt's (provider, auth_type, model)
   * tuple, or `null` when nothing is configured. Pre-filtered by the
   * controller's compatibility gate, so any keys present are already known
   * to be consumed by the attempt's provider.
   */
  modelParams: RequestParamDefaults | null | undefined;
  /** The provider that actually received (or will receive) the request. */
  provider: string;
}

export function snapshotRequestParams(
  input: RequestParamsSnapshotInput,
): RequestParamDefaults | null {
  const { body, modelParams, provider } = input;

  const merged = applyRequestParamDefaults(body, modelParams);

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
    // No client value and no user config touched this key for this request,
    // but the provider may still consume it with its own default value
    // (DeepSeek's `thinking` defaults to enabled, for example). Record
    // that effective state so the dashboard can answer "what did this
    // specific request actually have?" without the user having to know
    // the provider's silent defaults.
    if (key === 'thinking') {
      const providerDefault = providerThinkingDefault(provider);
      if (providerDefault !== undefined) {
        out.thinking = { type: providerDefault };
      }
    }
  }
  return Object.keys(out).length > 0 ? (out as unknown as RequestParamDefaults) : null;
}
