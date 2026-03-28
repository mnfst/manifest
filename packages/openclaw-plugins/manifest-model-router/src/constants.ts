// Environment variable names (fallback when plugin config is missing)
export const ENV = {
  API_KEY: 'MANIFEST_API_KEY',
  ENDPOINT: 'MANIFEST_ENDPOINT',
} as const;

// API key prefix — must match backend validation
export const API_KEY_PREFIX = 'mnfst_';

// Plugin defaults
export const DEFAULTS = {
  ENDPOINT: 'https://app.manifest.build',
  SERVICE_NAME: 'openclaw-gateway',
} as const;
