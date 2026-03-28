import { PluginLogger } from './types';

/**
 * Strip legacy `/otlp` suffix from endpoint for backward compatibility.
 * Logs a deprecation warning when the old format is detected.
 */
export function stripOtlpSuffix(endpoint: string, logger: PluginLogger): string {
  const cleaned = endpoint.replace(/\/otlp(\/v1)?\/?$/, '');
  if (cleaned !== endpoint) {
    logger.warn?.(
      `[manifest] Endpoint "${endpoint}" contains a deprecated /otlp suffix.\n` +
        `  The endpoint should now be the base URL (e.g. "${cleaned}").\n` +
        `  Update your config:\n` +
        `    openclaw config set plugins.entries.manifest-model-router.config.endpoint ${cleaned}`,
    );
  }
  return cleaned;
}
