import { API_KEY_PREFIX, DEFAULTS, DEV_DEFAULTS, ENV } from "./constants";

export interface ManifestConfig {
  mode: "cloud" | "local" | "dev";
  apiKey: string;
  endpoint: string;
  serviceName: string;
  captureContent: boolean;
  metricsIntervalMs: number;
  port: number;
  host: string;
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

  const mode =
    obj.mode === "cloud"
      ? "cloud" as const
      : obj.mode === "dev"
        ? "dev" as const
        : "local" as const;

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
    typeof obj.captureContent === "boolean"
      ? obj.captureContent
      : mode === "dev" || mode === "local";

  const defaultMetricsInterval =
    mode === "dev" ? DEV_DEFAULTS.METRICS_INTERVAL_MS : DEFAULTS.METRICS_INTERVAL_MS;

  const metricsIntervalMs =
    typeof obj.metricsIntervalMs === "number" &&
    obj.metricsIntervalMs >= 5000
      ? obj.metricsIntervalMs
      : defaultMetricsInterval;

  const port =
    typeof obj.port === "number" && obj.port > 0
      ? obj.port
      : 2099;

  const host =
    typeof obj.host === "string" && obj.host.length > 0
      ? obj.host
      : "127.0.0.1";

  return { mode, apiKey, endpoint, serviceName, captureContent, metricsIntervalMs, port, host };
}

export function validateConfig(config: ManifestConfig): string | null {
  // In local mode, API key is auto-generated — skip validation
  if (config.mode === "local") return null;

  // Dev mode requires an endpoint but no API key
  if (config.mode === "dev") {
    if (!config.endpoint.startsWith("http")) {
      return (
        `Invalid endpoint URL '${config.endpoint}'. ` +
        "Must start with http:// or https://. Fix it via:\n" +
        "  openclaw config set plugins.entries.manifest.config.endpoint http://localhost:38238/otlp"
      );
    }
    return null;
  }

  if (!config.apiKey) {
    return (
      "Missing apiKey. Set it via:\n" +
      `  openclaw config set manifest.apiKey ${API_KEY_PREFIX}YOUR_KEY\n` +
      `  or export MANIFEST_API_KEY=${API_KEY_PREFIX}YOUR_KEY`
    );
  }
  if (!config.apiKey.startsWith(API_KEY_PREFIX)) {
    return (
      "Invalid apiKey format. " +
      `Keys must start with '${API_KEY_PREFIX}'. Fix it via:\n` +
      `  openclaw config set manifest.apiKey ${API_KEY_PREFIX}YOUR_KEY`
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
