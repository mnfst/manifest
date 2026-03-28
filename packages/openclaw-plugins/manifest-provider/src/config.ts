import { API_KEY_PREFIX, DEFAULTS, ENV } from './constants';

export interface ManifestConfig {
  mode: 'cloud' | 'local';
  devMode: boolean;
  apiKey: string;
  endpoint: string;
  port: number;
  host: string;
}

export interface ParseResult {
  config: ManifestConfig;
  _deprecatedDevMode: boolean;
}

function isValidUrl(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isLoopback(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    const host = url.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  } catch {
    return false;
  }
}

export function parseConfig(raw: unknown): ManifestConfig {
  return parseConfigWithDeprecation(raw).config;
}

export function parseConfigWithDeprecation(raw: unknown): ParseResult {
  // OpenClaw may pass the full plugin entry { enabled, config: {...} }
  // or just the inner config object. Handle both.
  let obj: Record<string, unknown> =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  if (obj.config && typeof obj.config === 'object' && !Array.isArray(obj.config)) {
    obj = obj.config as Record<string, unknown>;
  }

  // Backward compat: mode: "dev" → mode: "cloud" + devMode: true
  let _deprecatedDevMode = false;
  let mode: 'cloud' | 'local';
  if (obj.mode === 'local') {
    mode = 'local';
  } else if (obj.mode === 'dev') {
    mode = 'cloud';
    _deprecatedDevMode = true;
  } else {
    mode = 'cloud';
  }

  const apiKey =
    typeof obj.apiKey === 'string' && obj.apiKey.length > 0
      ? obj.apiKey
      : process.env[ENV.API_KEY] || '';

  const envEndpoint = process.env[ENV.ENDPOINT];

  const endpoint =
    typeof obj.endpoint === 'string' && obj.endpoint.length > 0
      ? obj.endpoint
      : envEndpoint && envEndpoint.length > 0
        ? envEndpoint
        : DEFAULTS.ENDPOINT;

  const port = typeof obj.port === 'number' && obj.port > 0 ? obj.port : 2099;

  const host = typeof obj.host === 'string' && obj.host.length > 0 ? obj.host : '127.0.0.1';

  // Determine devMode: explicit config only (no auto-detection to avoid fail-open auth)
  let devMode: boolean;
  if (typeof obj.devMode === 'boolean') {
    devMode = obj.devMode;
  } else if (_deprecatedDevMode) {
    devMode = true;
  } else {
    devMode = false;
  }

  return {
    config: { mode, devMode, apiKey, endpoint, port, host },
    _deprecatedDevMode,
  };
}

export function validateConfig(config: ManifestConfig): string | null {
  // In local mode, API key is auto-generated — skip validation
  if (config.mode === 'local') return null;

  // devMode requires an endpoint but no API key
  if (config.devMode) {
    if (!isValidUrl(config.endpoint)) {
      return (
        `Invalid endpoint URL '${config.endpoint}'. ` +
        'Must be a valid http:// or https:// URL. Fix it via:\n' +
        '  openclaw config set plugins.entries.manifest.config.endpoint http://localhost:<PORT>'
      );
    }
    return null;
  }

  if (!config.apiKey) {
    return (
      'Missing apiKey. Set it via:\n' +
      `  openclaw config set plugins.entries.manifest.config.apiKey ${API_KEY_PREFIX}YOUR_KEY\n` +
      `  or export MANIFEST_API_KEY=${API_KEY_PREFIX}YOUR_KEY`
    );
  }
  if (!config.apiKey.startsWith(API_KEY_PREFIX)) {
    return (
      'Invalid apiKey format. ' +
      `Keys must start with '${API_KEY_PREFIX}'. Fix it via:\n` +
      `  openclaw config set plugins.entries.manifest.config.apiKey ${API_KEY_PREFIX}YOUR_KEY`
    );
  }
  if (!isValidUrl(config.endpoint)) {
    return (
      `Invalid endpoint URL '${config.endpoint}'. ` +
      'Must be a valid http:// or https:// URL. Fix it via:\n' +
      '  openclaw config set plugins.entries.manifest.config.endpoint https://app.manifest.build\n\n' +
      'Or run the setup wizard:\n' +
      '  openclaw providers setup manifest'
    );
  }
  return null;
}
