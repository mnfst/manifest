import type { ProviderParamSpec } from './provider-params-spec';
import type { JsonValue, RequestParamDefaults } from './request-params';

/**
 * The snapshot of which request body parameters were *effectively in play*
 * for a given proxy attempt — the union of:
 *
 * 1. Whatever route-supported param keys the client sent in their body (top
 *    precedence by presence — including explicit `null`).
 * 2. The user's stored params for this attempt's (provider, auth_type,
 *    model) tuple, looked up from the scoped `agent_model_params` table.
 * 3. The provider/auth/model spec's natural UI default so a request where
 *    neither the client nor the user configured anything still records the
 *    effective value.
 *
 * Recorded per-message on `agent_messages.request_params` so the dashboard
 * can show "this request had thinking=disabled" alongside Request Headers
 * in the expanded row. Returns `null` when no known params are present —
 * the UI hides the accordion in that case to avoid noise.
 *
 * Serializers are intentionally not involved: snapshots record UI/storage
 * values, not provider wire shapes.
 */
export interface RequestParamsSnapshotInput {
  /** The inbound (pre-merge) client request body. */
  body: Record<string, unknown>;
  /**
   * Saved per-route params for the attempt's scoped (provider, auth_type,
   * model) tuple, or `null` when nothing is configured. Pre-filtered by the
   * controller's compatibility gate, so any keys present are already known
   * to be consumed by the attempt's provider.
   */
  modelParams: RequestParamDefaults | null | undefined;
  /** The route-supported params for the provider/auth/model attempt. */
  specs: readonly ProviderParamSpec[];
}

export function snapshotRequestParams(
  input: RequestParamsSnapshotInput,
): RequestParamDefaults | null {
  const { body, modelParams, specs } = input;
  const out: RequestParamDefaults = {};
  for (const spec of specs) {
    if (spec.key in body) {
      out[spec.key] = body[spec.key] as JsonValue;
      continue;
    }
    if (modelParams && spec.key in modelParams) {
      out[spec.key] = modelParams[spec.key];
      continue;
    }
    out[spec.key] = spec.control.default;
  }
  return Object.keys(out).length > 0 ? out : null;
}
