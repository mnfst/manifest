import { ManifestConfig } from './config';
import { PluginLogger } from './types';
import { stripOtlpSuffix } from './compat';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Registers Manifest as an OpenAI-compatible provider in OpenClaw.
 * OpenClaw sends `POST /v1/chat/completions` requests to Manifest,
 * which scores, picks the real model, and forwards to the actual provider.
 */
export function registerRouting(api: any, config: ManifestConfig, logger: PluginLogger): void {
  if (typeof api.registerProvider !== 'function') {
    logger.debug('[manifest] registerProvider not available, skipping provider registration');
    return;
  }

  const baseUrl = stripOtlpSuffix(config.endpoint, logger);

  try {
    api.registerProvider({
      id: 'manifest',
      name: 'Manifest Router',
      label: 'Manifest Router',
      api: 'openai-completions',
      baseUrl,
      apiKey: config.apiKey,
      models: ['auto'],
    });

    logger.info('[manifest] Registered as OpenAI-compatible provider (proxy mode)');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`[manifest] registerProvider failed (${msg})`);
  }
}
