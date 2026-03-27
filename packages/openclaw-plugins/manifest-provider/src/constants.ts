// Environment variable names (fallback when plugin config is missing)
export const ENV = {
  API_KEY: 'MANIFEST_API_KEY',
  ENDPOINT: 'MANIFEST_ENDPOINT',
} as const;

// Re-export from shared — single source of truth
export { API_KEY_PREFIX } from 'manifest-shared';

// Plugin defaults
export const DEFAULTS = {
  ENDPOINT: 'https://app.manifest.build',
  SERVICE_NAME: 'openclaw-gateway',
} as const;
