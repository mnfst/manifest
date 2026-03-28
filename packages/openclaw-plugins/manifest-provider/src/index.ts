import { parseConfigWithDeprecation, validateConfig } from './config';
import { PluginLogger } from './types';
import { registerTools } from './tools';
import { registerCommand } from './command';
import { verifyConnection } from './verify';
import { injectProviderConfig, injectAuthProfile } from './provider-inject';
import { stripOtlpSuffix } from './compat';
import { runApiKeyAuth, buildModelConfig } from './auth';
import { ENV } from './constants';

/* eslint-disable @typescript-eslint/no-explicit-any */
module.exports = {
  id: 'manifest-provider',
  name: 'Manifest Provider — Smart LLM Router',

  register(api: any) {
    const logger: PluginLogger = api.logger || {
      info: (...args: unknown[]) => console.log(...args),
      debug: () => {},
      error: (...args: unknown[]) => console.error(...args),
      warn: (...args: unknown[]) => console.warn(...args),
    };

    const { config, _deprecatedDevMode } = parseConfigWithDeprecation(api.pluginConfig);

    if (_deprecatedDevMode) {
      logger.warn?.(
        '[manifest] mode: "dev" is deprecated. Use mode: "cloud" with devMode: true instead.\n' +
          '  openclaw config set plugins.entries.manifest.config.mode cloud\n' +
          '  openclaw config set plugins.entries.manifest.config.devMode true',
      );
    }

    // Register as a provider plugin with auth onboarding
    registerProvider(api, config.endpoint, logger);

    if (config.mode === 'local') {
      logger.info(
        '[manifest-provider] Local mode requires the manifest plugin.\n' +
          '  Install it with: openclaw plugins install manifest\n' +
          '  Then restart: openclaw gateway restart',
      );
      return;
    }

    const error = validateConfig(config);
    if (error) {
      if (!config.devMode && config.mode === 'cloud' && !config.apiKey) {
        logger.info(
          '[manifest] Cloud mode requires an API key.\n\n' +
            'Run the setup wizard:\n' +
            '  openclaw providers setup manifest\n\n' +
            'Or set your key manually:\n' +
            '  openclaw config set plugins.entries.manifest.config.apiKey mnfst_YOUR_KEY\n' +
            '  openclaw gateway restart',
        );
      } else {
        logger.error(`[manifest] Configuration error:\n${error}`);
      }
      return;
    }

    // Derive the base origin (strip legacy /otlp suffix for backward compat).
    const baseOrigin = stripOtlpSuffix(config.endpoint, logger);

    // Unified cloud/dev path
    const effectiveKey = config.devMode ? 'dev-no-auth' : config.apiKey;

    logger.info(
      config.devMode
        ? '[manifest] Dev mode — connecting to external server...'
        : '[manifest] Initializing routing...',
    );

    injectProviderConfig(api, `${baseOrigin}/v1`, effectiveKey, logger);
    injectAuthProfile(effectiveKey, logger);

    if (typeof api.registerTool === 'function') {
      registerTools(api, config, logger);
    } else if (!config.devMode) {
      logger.info('[manifest] Agent tools not available in this OpenClaw version');
    }
    registerCommand(api, config, logger);

    if (config.devMode) {
      logger.info(`[manifest]   Dashboard: ${baseOrigin}`);
    }

    api.registerService({
      id: 'manifest-routing',
      start: () => {
        logger.info(
          config.devMode ? '[manifest] Dev mode routing active' : '[manifest] Routing active',
        );
        logger.info(`[manifest]   Endpoint=${config.endpoint}`);

        verifyConnection(config)
          .then((check) => {
            if (check.error) {
              logger.warn?.(`[manifest] Connection check failed: ${check.error}`);
              return;
            }
            const agent = check.agentName ? ` (agent: ${check.agentName})` : '';
            logger.info(`[manifest] Connection verified${agent}`);
          })
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            logger.debug(`[manifest] Connection verify error: ${msg}`);
          });
      },
    });
  },
};

/**
 * Registers Manifest as a provider in OpenClaw with interactive auth onboarding.
 * This enables `openclaw providers setup manifest` for easy cloud setup.
 */
function registerProvider(api: any, endpoint: string, logger: PluginLogger): void {
  if (typeof api.registerProvider !== 'function') {
    logger.debug('[manifest] registerProvider not available, skipping provider registration');
    return;
  }

  try {
    api.registerProvider({
      id: 'manifest',
      label: 'Manifest Router',
      envVars: [ENV.API_KEY],
      auth: [
        {
          id: 'api-key',
          label: 'Manifest API Key',
          hint: 'Get your key at https://app.manifest.build',
          kind: 'api_key',
          run: runApiKeyAuth,
        },
      ],
      models: buildModelConfig(stripOtlpSuffix(endpoint, { info: () => {}, error: () => {}, debug: () => {} })),
    });

    logger.info('[manifest] Registered as provider (model: manifest/auto)');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`[manifest] registerProvider failed (${msg})`);
  }
}
