import { readFileSync } from 'fs';
import { resolve } from 'path';

export const DEFAULT_TELEMETRY_ENDPOINT = 'https://telemetry.manifest.build/v1/report';
export const TELEMETRY_SCHEMA_VERSION = 1;
export const TELEMETRY_DOCS_URL = 'https://manifest.build/docs/self-hosted#telemetry';

export interface TelemetryConfig {
  enabled: boolean;
  endpoint: string;
  manifestVersion: string;
}

/**
 * Opt-out with `MANIFEST_TELEMETRY_DISABLED=1`. Also auto-silenced outside
 * production so dev instances and test runs never report.
 */
export function buildTelemetryConfig(env: NodeJS.ProcessEnv = process.env): TelemetryConfig {
  const disabled = env['MANIFEST_TELEMETRY_DISABLED'];
  const isProd = (env['NODE_ENV'] ?? 'development') === 'production';
  const isDisabled = disabled === '1' || disabled === 'true';
  return {
    enabled: isProd && !isDisabled,
    endpoint: env['TELEMETRY_ENDPOINT'] ?? DEFAULT_TELEMETRY_ENDPOINT,
    manifestVersion: readManifestVersion(),
  };
}

export function readManifestVersion(): string {
  try {
    const path = resolve(__dirname, '../../../manifest/package.json');
    const raw = readFileSync(path, 'utf8');
    const pkg = JSON.parse(raw) as { version?: unknown };
    if (typeof pkg.version === 'string') return pkg.version;
    return 'unknown';
  } catch {
    return 'unknown';
  }
}
