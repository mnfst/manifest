import { parseConfig, validateConfig, ManifestConfig } from "./config";
import { initTelemetry, shutdownTelemetry, PluginLogger } from "./telemetry";
import { registerHooks, initMetrics } from "./hooks";
import { registerRouting } from "./routing";
import { registerTools } from "./tools";
import { verifyConnection } from "./verify";
import { registerLocalMode, injectProviderConfig, injectAuthProfile } from "./local-mode";
import { trackPluginEvent } from "./product-telemetry";

/* eslint-disable @typescript-eslint/no-explicit-any */
module.exports = {
  id: "manifest",
  name: "Manifest — Agent Observability",

  register(api: any) {
    const logger: PluginLogger = api.logger || {
      info: (...args: unknown[]) => console.log(...args),
      debug: () => {},
      error: (...args: unknown[]) => console.error(...args),
      warn: (...args: unknown[]) => console.warn(...args),
    };

    const config: ManifestConfig = parseConfig(api.pluginConfig);
    if (config.mode !== "dev") {
      trackPluginEvent("plugin_registered");
      trackPluginEvent("plugin_mode_selected", { mode: config.mode });
    }

    if (config.mode === "local") {
      registerLocalMode(api, config, logger);
      return;
    }

    const error = validateConfig(config);
    if (error) {
      if (config.mode === "cloud" && !config.apiKey) {
        logger.info(
          "[manifest] Cloud mode requires an API key:\n" +
            "  openclaw config set plugins.entries.manifest.config.apiKey mnfst_YOUR_KEY\n" +
            "  openclaw gateway restart\n\n" +
            "Tip: Remove the mode setting to use local mode instead (zero config).",
        );
      } else {
        logger.error(`[manifest] Configuration error:\n${error}`);
      }
      return;
    }

    // Detect built-in diagnostics-otel conflict
    const entries = api.config?.plugins?.entries || {};
    if (entries["diagnostics-otel"]?.enabled) {
      logger.error(
        "[manifest] ERROR: Built-in 'diagnostics-otel' is also enabled. " +
          "This causes duplicate OTel registration errors. " +
          "Disable it now:\n" +
          "  openclaw plugins disable diagnostics-otel\n" +
          "Then restart the gateway.",
      );
      return;
    }

    // Derive the base origin from the OTLP endpoint (strip /otlp suffix).
    // Used by both dev and cloud modes to build the provider baseUrl.
    const baseOrigin = config.endpoint.replace(/\/otlp(\/v1)?\/?$/, "");

    // Dev mode: connect to an external server without API key
    if (config.mode === "dev") {
      logger.info("[manifest] Dev mode — connecting to external server...");

      const devPlaceholderKey = "dev-no-auth";
      injectProviderConfig(api, `${baseOrigin}/v1`, devPlaceholderKey, logger);
      injectAuthProfile(devPlaceholderKey, logger);

      const { tracer, meter } = initTelemetry(config, logger);
      initMetrics(meter);
      registerHooks(api, tracer, config, logger);
      registerRouting(api, config, logger);

      if (typeof api.registerTool === "function") {
        registerTools(api, config, logger);
      }

      logger.info(`[manifest]   Dashboard: ${baseOrigin}`);

      api.registerService({
        id: "manifest-dev",
        start: () => {
          logger.info("[manifest] Dev mode pipeline active");
          logger.info(`[manifest]   Endpoint=${config.endpoint}`);

          verifyConnection(config).then((check) => {
            if (check.error) {
              logger.warn?.(`[manifest] Connection check failed: ${check.error}`);
              return;
            }
            const agent = check.agentName ? ` (agent: ${check.agentName})` : "";
            logger.info(`[manifest] Connection verified${agent}`);
          }).catch(() => {});
        },
        stop: async () => {
          await shutdownTelemetry(logger);
        },
      });

      return;
    }

    // Cloud mode
    logger.info("[manifest] Initializing observability pipeline...");

    // Sync the provider config file so the gateway uses the correct
    // baseUrl and apiKey for proxy requests after restarts.
    injectProviderConfig(api, `${baseOrigin}/v1`, config.apiKey, logger);
    injectAuthProfile(config.apiKey, logger);

    const { tracer, meter } = initTelemetry(config, logger);
    initMetrics(meter);
    registerHooks(api, tracer, config, logger);
    registerRouting(api, config, logger);

    if (typeof api.registerTool === "function") {
      registerTools(api, config, logger);
    } else {
      logger.info(
        "[manifest] Agent tools not available in this OpenClaw version",
      );
    }

    api.registerService({
      id: "manifest-telemetry",
      start: () => {
        logger.info("[manifest] Observability pipeline active");
        logger.info(`[manifest]   Endpoint=${config.endpoint}`);

        // Non-blocking connection verify after startup
        verifyConnection(config).then((check) => {
          if (check.error) {
            logger.warn?.(`[manifest] Connection check failed: ${check.error}`);
            return;
          }
          const agent = check.agentName ? ` (agent: ${check.agentName})` : "";
          logger.info(`[manifest] Connection verified${agent}`);
        }).catch(() => {
          // Swallow — startup should never fail on verify
        });
      },
      stop: async () => {
        await shutdownTelemetry(logger);
      },
    });
  },
};
