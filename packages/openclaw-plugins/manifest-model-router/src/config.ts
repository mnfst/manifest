import { API_KEY_PREFIX, DEFAULTS, ENV } from './constants';

export interface ManifestConfig {
  devMode: boolean;
  apiKey: string;
  endpoint: string;
  port: number;
  host: string;
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
  // OpenClaw may pass the full plugin entry { enabled, config: {...} }
  // or just the inner config object. Handle both.
  let obj: Record<string, unknown> =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  if (obj.config && typeof obj.config === 'object' && !Array.isArray(obj.config)) {
    obj = obj.config as Record<string, unknown>;
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

  // Determine devMode: explicit > legacy mode: "dev" > auto-detect
  let devMode: boolean;
  if (typeof obj.devMode === 'boolean') {
    devMode = obj.devMode;
  } else if (obj.mode === 'dev') {
    // Backward compat: legacy mode: "dev" silently enables devMode
    devMode = true;
  } else {
    // Auto-detect: loopback endpoint + no mnfst_ API key
    devMode = isLoopback(endpoint) && !apiKey.startsWith(API_KEY_PREFIX);
  }

  return { devMode, apiKey, endpoint, port, host };
}

export function validateConfig(config: ManifestConfig): string | null {
  // devMode requires an endpoint but no API key
  if (config.devMode) {
    if (!config.endpoint.startsWith('http')) {
      return (
        `Invalid endpoint URL '${config.endpoint}'. ` +
        'Must start with http:// or https://. Fix it via:\n' +
        '  openclaw config set plugins.entries.manifest-model-router.config.endpoint http://localhost:<PORT>'
      );
    }
    return null;
  }

  if (!config.apiKey) {
    return (
      'Missing apiKey. Set it via:\n' +
      `  openclaw config set plugins.entries.manifest-model-router.config.apiKey ${API_KEY_PREFIX}YOUR_KEY\n` +
      `  or export MANIFEST_API_KEY=${API_KEY_PREFIX}YOUR_KEY`
    );
  }
  if (!config.apiKey.startsWith(API_KEY_PREFIX)) {
    return (
      'Invalid apiKey format. ' +
      `Keys must start with '${API_KEY_PREFIX}'. Fix it via:\n` +
      `  openclaw config set plugins.entries.manifest-model-router.config.apiKey ${API_KEY_PREFIX}YOUR_KEY`
    );
  }
  if (!config.endpoint.startsWith('http')) {
    return (
      `Invalid endpoint URL '${config.endpoint}'. ` +
      'Must start with http:// or https://. Fix it via:\n' +
      '  openclaw config set plugins.entries.manifest-model-router.config.endpoint https://app.manifest.build\n\n' +
      'Or run the setup wizard:\n' +
      '  openclaw providers setup manifest'
    );
  }
  return null;
}
