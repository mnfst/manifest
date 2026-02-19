import { DEFAULTS, ENV } from "./constants";

export interface ManifestConfig {
  apiKey: string;
  endpoint: string;
  serviceName: string;
  captureContent: boolean;
  metricsIntervalMs: number;
}

export function parseConfig(raw: unknown): ManifestConfig {
  // OpenClaw may pass the full plugin entry { enabled, config: {...} }
  // or just the inner config object. Handle both.
  let obj: Record<string, unknown> =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  if (
    obj.config &&
    typeof obj.config === "object" &&
    !Array.isArray(obj.config)
  ) {
    obj = obj.config as Record<string, unknown>;
  }

  const apiKey =
    typeof obj.apiKey === "string" && obj.apiKey.length > 0
      ? obj.apiKey
      : process.env[ENV.API_KEY] || "";

  const envEndpoint = process.env[ENV.ENDPOINT];

  const endpoint =
    typeof obj.endpoint === "string" && obj.endpoint.length > 0
      ? obj.endpoint
      : envEndpoint && envEndpoint.length > 0
        ? envEndpoint
        : DEFAULTS.ENDPOINT;

  const serviceName =
    typeof obj.serviceName === "string" && obj.serviceName.length > 0
      ? obj.serviceName
      : DEFAULTS.SERVICE_NAME;

  const captureContent =
    typeof obj.captureContent === "boolean" ? obj.captureContent : false;

  const metricsIntervalMs =
    typeof obj.metricsIntervalMs === "number" &&
    obj.metricsIntervalMs >= 5000
      ? obj.metricsIntervalMs
      : DEFAULTS.METRICS_INTERVAL_MS;

  return { apiKey, endpoint, serviceName, captureContent, metricsIntervalMs };
}

export function validateConfig(config: ManifestConfig): string | null {
  if (!config.apiKey) {
    return (
      "Missing apiKey. Set it via:\n" +
      "  openclaw config set manifest.apiKey mnfst_YOUR_KEY\n" +
      "  or export MANIFEST_API_KEY=mnfst_YOUR_KEY"
    );
  }
  if (!config.apiKey.startsWith("mnfst_")) {
    return (
      "Invalid apiKey format. " +
      "Keys must start with 'mnfst_'. Fix it via:\n" +
      "  openclaw config set manifest.apiKey mnfst_YOUR_KEY"
    );
  }
  if (!config.endpoint.startsWith("http")) {
    return (
      `Invalid endpoint URL '${config.endpoint}'. ` +
      "Must start with http:// or https://. Fix it via:\n" +
      "  openclaw config set plugins.entries.manifest.config.endpoint https://app.manifest.build/otlp"
    );
  }
  return null;
}
