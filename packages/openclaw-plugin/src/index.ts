import { parseConfig, validateConfig, ManifestConfig } from "./config";
import { initTelemetry, shutdownTelemetry, PluginLogger } from "./telemetry";
import { registerHooks, initMetrics } from "./hooks";
import { registerTools } from "./tools";
import { verifyConnection } from "./verify";
import { registerLocalMode } from "./local-mode";
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
    trackPluginEvent("plugin_registered");
    trackPluginEvent("plugin_mode_selected", { mode: config.mode });

    if (config.mode === "local") {
      registerLocalMode(api, config, logger);
      return;
    }

    const error = validateConfig(config);
    if (error) {
      // No key at all = fresh install, show friendly next-steps
      if (!config.apiKey) {
        logger.info(
          "[manifest] Installed! Complete setup:\n" +
            "  1. openclaw config set plugins.entries.manifest.config.apiKey mnfst_YOUR_KEY\n" +
            "  2. openclaw gateway restart",
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

    logger.info("[manifest] Initializing observability pipeline...");

    const { tracer, meter } = initTelemetry(config, logger);
    initMetrics(meter);
    registerHooks(api, tracer, config, logger);

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
