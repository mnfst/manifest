export interface TelemetryConfig {
  optedOut: boolean;
  packageVersion: string;
}

export function getTelemetryConfig(): TelemetryConfig {
  return {
    optedOut:
      process.env.MANIFEST_TELEMETRY_OPTOUT === "1" ||
      process.env.MANIFEST_TELEMETRY_OPTOUT === "true",
    packageVersion: process.env.PLUGIN_VERSION ?? "unknown",
  };
}
