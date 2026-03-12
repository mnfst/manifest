import { parseConfigWithDeprecation, validateConfig, ManifestConfig } from './config';
import { initTelemetry, shutdownTelemetry, PluginLogger } from './telemetry';
import { registerHooks, initMetrics } from './hooks';
import { registerRouting } from './routing';
import { registerTools } from './tools';
import { registerCommand } from './command';
import { verifyConnection } from './verify';
import { registerLocalMode, injectProviderConfig, injectAuthProfile } from './local-mode';
import { trackPluginEvent } from './product-telemetry';
import { discoverSubscriptionProviders, registerSubscriptionProviders } from './subscription';

/* eslint-disable @typescript-eslint/no-explicit-any */
module.exports = {
  id: 'manifest',
  name: 'Manifest — Agent Observability',

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

    if (!config.devMode) {
      trackPluginEvent('plugin_registered', undefined, config.mode);
      trackPluginEvent('plugin_mode_selected', { mode: config.mode }, config.mode);
    }

    if (config.mode === 'local') {
      registerLocalMode(api, config, logger);
      return;
    }

    const error = validateConfig(config);
    if (error) {
      if (!config.devMode && config.mode === 'cloud' && !config.apiKey) {
        logger.info(
          '[manifest] Cloud mode requires an API key:\n' +
            '  openclaw config set plugins.entries.manifest.config.apiKey mnfst_YOUR_KEY\n' +
            '  openclaw gateway restart\n\n' +
            'Tip: Set mode to local for a zero-config embedded server:\n' +
            '  openclaw config set plugins.entries.manifest.config.mode local\n' +
            '  openclaw gateway restart',
        );
      } else {
        logger.error(`[manifest] Configuration error:\n${error}`);
      }
      return;
    }

    // Detect built-in diagnostics-otel conflict
    const entries = api.config?.plugins?.entries || {};
    if (entries['diagnostics-otel']?.enabled) {
      logger.error(
        "[manifest] ERROR: Built-in 'diagnostics-otel' is also enabled. " +
          'This causes duplicate OTel registration errors. ' +
          'Disable it now:\n' +
          '  openclaw plugins disable diagnostics-otel\n' +
          'Then restart the gateway.',
      );
      return;
    }

    // Derive the base origin from the OTLP endpoint (strip /otlp suffix).
    const baseOrigin = config.endpoint.replace(/\/otlp(\/v1)?\/?$/, '');

    // Unified cloud/dev path
    const effectiveKey = config.devMode ? 'dev-no-auth' : config.apiKey;
    const serviceId = config.devMode ? 'manifest-dev' : 'manifest-telemetry';

    logger.info(
      config.devMode
        ? '[manifest] Dev mode — connecting to external server...'
        : '[manifest] Initializing observability pipeline...',
    );

    injectProviderConfig(api, `${baseOrigin}/v1`, effectiveKey, logger);
    injectAuthProfile(effectiveKey, logger);

    const { tracer, meter } = initTelemetry(config, logger);
    initMetrics(meter);
    registerHooks(api, tracer, config, logger);
    registerRouting(api, config, logger);

    if (typeof api.registerTool === 'function') {
      registerTools(api, config, logger);
    } else if (!config.devMode) {
      logger.info('[manifest] Agent tools not available in this OpenClaw version');
    }
    registerCommand(api, config, logger);

    if (config.devMode) {
      logger.info(`[manifest]   Dashboard: ${baseOrigin}`);
    }

    // Discover subscription providers from OpenClaw auth profiles
    const subscriptions = discoverSubscriptionProviders(logger);

    api.registerService({
      id: serviceId,
      start: () => {
        logger.info(
          config.devMode
            ? '[manifest] Dev mode pipeline active'
            : '[manifest] Observability pipeline active',
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
          .catch(() => {});

        // Register subscription providers after startup
        registerSubscriptionProviders(subscriptions, config.endpoint, effectiveKey, logger).catch(
          () => {},
        );
      },
      stop: async () => {
        await shutdownTelemetry(logger);
      },
    });
  },
};
