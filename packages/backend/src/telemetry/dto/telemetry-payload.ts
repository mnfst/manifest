/**
 * Shape of the payload POSTed once per 24h from a self-hosted install to the
 * ingest endpoint. All fields are derived aggregates — no per-request events,
 * no identifiers beyond the random `install_id` and the Manifest version.
 * Additive changes keep `schema_version: 1`; breaking changes bump it.
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

  // Configuration
  agents_total: number;
  agents_by_platform: Record<string, number>;

  // Runtime
  platform: string;
  arch: string;
}
