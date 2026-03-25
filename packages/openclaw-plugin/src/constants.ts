// Environment variable names (fallback when plugin config is missing)
export const ENV = {
  API_KEY: 'MANIFEST_API_KEY',
  ENDPOINT: 'MANIFEST_ENDPOINT',
} as const;

// API key prefix — must match the backend's API_KEY_PREFIX
export const API_KEY_PREFIX = 'mnfst_' as const;

// Plugin defaults
export const DEFAULTS = {
  ENDPOINT: 'https://app.manifest.build',
  SERVICE_NAME: 'openclaw-gateway',
} as const;
