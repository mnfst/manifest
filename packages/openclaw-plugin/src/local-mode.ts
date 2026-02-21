/* eslint-disable @typescript-eslint/no-require-imports */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { randomBytes } from "crypto";
import { ManifestConfig } from "./config";
import { PluginLogger } from "./telemetry";
import { initTelemetry, shutdownTelemetry } from "./telemetry";
import { registerHooks, initMetrics } from "./hooks";
import { registerTools } from "./tools";
import { API_KEY_PREFIX } from "./constants";

const CONFIG_DIR = join(homedir(), ".openclaw", "manifest");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

interface LocalConfig {
  apiKey: string;
}

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadOrGenerateApiKey(): string {
  ensureConfigDir();

  if (existsSync(CONFIG_FILE)) {
    try {
      const data = JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as LocalConfig;
      if (data.apiKey && data.apiKey.startsWith(API_KEY_PREFIX)) {
        return data.apiKey;
      }
    } catch {
      // Regenerate if corrupted
    }
  }

  const key = `${API_KEY_PREFIX}local_${randomBytes(24).toString("hex")}`;
  writeFileSync(CONFIG_FILE, JSON.stringify({ apiKey: key }, null, 2));
  return key;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function registerLocalMode(
  api: any,
  config: ManifestConfig,
  logger: PluginLogger,
) {
  const port = config.port;
  const host = config.host;
  const apiKey = loadOrGenerateApiKey();
  const dbPath = join(CONFIG_DIR, "manifest.db");

  logger.info("[manifest] Local mode — starting embedded server...");

  // Try to load the server package
  let serverModule: { start: (opts: Record<string, unknown>) => Promise<unknown>; version?: string };
  try {
    serverModule = require("@manifest/server");
  } catch {
    logger.error(
      "[manifest] @manifest/server is not installed.\n" +
        "  Install it with: npm install @manifest/server\n" +
        "  Then restart the gateway.",
    );
    return;
  }

  // Override config for local telemetry endpoint
  const localEndpoint = `http://${host}:${port}/otlp`;
  const localConfig: ManifestConfig = {
    ...config,
    apiKey,
    endpoint: localEndpoint,
  };

  const { tracer, meter } = initTelemetry(localConfig, logger);
  initMetrics(meter);
  registerHooks(api, tracer, localConfig, logger);

  if (typeof api.registerTool === "function") {
    registerTools(api, localConfig, logger);
  }

  api.registerService({
    id: "manifest-local",
    start: async () => {
      try {
        await serverModule.start({ port, host, dbPath });
        logger.info(`[manifest] Local server running on http://${host}:${port}`);
        logger.info(`[manifest]   Dashboard: http://${host}:${port}`);
        logger.info(`[manifest]   DB: ${dbPath}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("EADDRINUSE") || msg.includes("address already in use")) {
          logger.error(
            `[manifest] Port ${port} is already in use.\n` +
              `  Change it with: openclaw config set plugins.entries.manifest.config.port ${port + 1}\n` +
              `  Then restart the gateway.`,
          );
        } else {
          logger.error(`[manifest] Failed to start local server: ${msg}`);
        }
      }
    },
    stop: async () => {
      await shutdownTelemetry(logger);
    },
  });
}
