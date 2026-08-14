/**
 * Shape of the payload POSTed once per 24h from a self-hosted install to the
 * ingest endpoint. All fields are derived aggregates — no per-request events,
 * no identifiers beyond the random `install_id` and the Manifest version.
 * Additive changes keep `schema_version: 1`; breaking changes bump it.
 *
 * Optional fields are flagged as such because installs running older Manifest
 * versions emit a strict subset. Receivers should feature-detect on presence,
 * not on `schema_version`.
 */
export interface TelemetryPayloadV1 {
  schema_version: 1;
  install_id: string;
  manifest_version: string;

  // Activity
  messages_total: number;
  messages_by_provider: Record<string, number>;
  messages_by_tier: Record<string, number>;
  messages_by_auth_type: Record<string, number>;

  // Volume
  tokens_input_total: number;
  tokens_output_total: number;

  /**
   * Total dollar value flowing through the install over the 24h window,
   * summed from the same `cost_usd` Manifest computes at routing time.
   * Rounded to cents to avoid leaking precision. Always present on installs
   * that ship this field — `0` when nothing chargeable was routed (e.g.
   * Ollama-only fleets). Optional in the DTO because older installs predate
   * the field; absence means "fall back to estimating from token counts".
   */
  cost_usd_total?: number;

  /**
   * Per-provider breakdown of `cost_usd_total`, keyed by the same canonical
   * provider buckets as `messages_by_provider` (registry ID for known
   * providers, `"custom"` for user-defined ones, `"unknown"` for legacy
   * NULLs). Values rounded to cents. Empty `{}` when no chargeable rows.
   */
  cost_usd_by_provider?: Record<string, number>;

  // Configuration
  agents_total: number;
  agents_by_platform: Record<string, number>;

  // Runtime
  platform: string;
  arch: string;
}
