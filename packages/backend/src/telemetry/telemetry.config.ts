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
 * production so dev instances and test runs never report. Also silenced
 * when the Manifest version can't be read — the ingest validates
 * `manifest_version` as semver, so a misconfigured image without
 * `packages/manifest/package.json` would otherwise spam the endpoint
 * with 400s.
 *
 * Cloud (`MANIFEST_MODE=cloud`) never reports: the payload is designed for
 * anonymous self-hosted fleets, and the cloud deployment already has its
 * own `agent_messages` analytics. Letting cloud phone home double-counts
 * the same traffic under Peacock's Local series (the cloud install_id
 * shows up as the self-hosted "whale").
 */
export function buildTelemetryConfig(env: NodeJS.ProcessEnv = process.env): TelemetryConfig {
  const disabled = env['MANIFEST_TELEMETRY_DISABLED'];
  const isProd = (env['NODE_ENV'] ?? 'development') === 'production';
  const isDisabled = disabled === '1' || disabled === 'true';
  // Explicit cloud only — self-hosted (selfhosted/local/auto-detect) keeps
  // reporting. Do not use isSelfHosted() here: bare-metal self-host without
  // MANIFEST_MODE defaults to "cloud" detection but should still be able to
  // opt into telemetry via MANIFEST_MODE=selfhosted or by not setting cloud.
  const isCloud = env['MANIFEST_MODE'] === 'cloud';
  const manifestVersion = readManifestVersion();
  const versionReadable = manifestVersion !== UNKNOWN_VERSION;
  return {
    enabled: isProd && !isDisabled && !isCloud && versionReadable,
    endpoint: env['TELEMETRY_ENDPOINT'] ?? DEFAULT_TELEMETRY_ENDPOINT,
    manifestVersion,
  };
}

export const UNKNOWN_VERSION = 'unknown';

export function readManifestVersion(): string {
  try {
    const path = resolve(__dirname, '../../../manifest/package.json');
    const raw = readFileSync(path, 'utf8');
    const pkg = JSON.parse(raw) as { version?: unknown };
    if (typeof pkg.version === 'string') return pkg.version;
    return UNKNOWN_VERSION;
  } catch {
    return UNKNOWN_VERSION;
  }
}
