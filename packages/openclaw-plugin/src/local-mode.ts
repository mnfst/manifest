/* eslint-disable @typescript-eslint/no-require-imports */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
} from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { randomBytes } from "crypto";
import { ManifestConfig } from "./config";
import { PluginLogger } from "./telemetry";
import { initTelemetry, shutdownTelemetry } from "./telemetry";
import { registerHooks, initMetrics } from "./hooks";
import { registerRouting } from "./routing";
import { registerTools } from "./tools";
import { registerCommand } from "./command";
import { API_KEY_PREFIX } from "./constants";

const CONFIG_DIR = join(homedir(), ".openclaw", "manifest");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const OPENCLAW_DIR = join(homedir(), ".openclaw");
const OPENCLAW_CONFIG = join(OPENCLAW_DIR, "openclaw.json");
const HEALTH_TIMEOUT_MS = 3000;

interface LocalConfig {
  apiKey: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
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
  let existing: Record<string, unknown> = {};
  if (existsSync(CONFIG_FILE)) {
    try {
      existing = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    } catch {
      // Overwrite if corrupted
    }
  }
  writeFileSync(CONFIG_FILE, JSON.stringify({ ...existing, apiKey: key }, null, 2), { mode: 0o600 });
  return key;
}

function readJsonSafe(path: string): Record<string, any> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return {};
  }
}

function atomicWriteJson(path: string, data: unknown): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const tmp = `${path}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  renameSync(tmp, path);
}

// TODO: Replace direct file mutation with api.config persistent API
// when OpenClaw documents a write-through config mechanism.
// See: https://docs.openclaw.ai/tools/plugin#configuration

/**
 * Injects the Manifest provider configuration into OpenClaw's config file
 * and runtime config so that `manifest/auto` is recognized as a valid model.
 *
 * `baseUrl` must include the `/v1` path (e.g. `http://127.0.0.1:2099/v1`
 * or `https://app.manifest.build/v1`).
 */
export function injectProviderConfig(
  api: any,
  baseUrl: string,
  apiKey: string,
  logger: PluginLogger,
): void {

  const providerConfig = {
    baseUrl,
    api: "openai-completions",
    apiKey,
    models: [{ id: "auto", name: "auto" }],
  };

  // 1. Write to ~/.openclaw/openclaw.json (atomic write)
  try {
    const config = readJsonSafe(OPENCLAW_CONFIG);

    if (!config.models) config.models = {};
    if (!config.models.providers) config.models.providers = {};
    config.models.providers.manifest = providerConfig;

    // Add manifest/auto to the model allowlist
    if (!config.agents) config.agents = {};
    if (!config.agents.defaults) config.agents.defaults = {};
    if (!config.agents.defaults.models) config.agents.defaults.models = {};

    const models = config.agents.defaults.models;
    if (Array.isArray(models)) {
      if (!models.includes("manifest/auto")) models.push("manifest/auto");
    } else if (typeof models === "object") {
      if (!("manifest/auto" in models)) models["manifest/auto"] = {};
    }

    atomicWriteJson(OPENCLAW_CONFIG, config);
    logger.debug("[manifest] Wrote provider config to openclaw.json");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`[manifest] Could not write openclaw.json: ${msg}`);
  }

  // 2. Set runtime config for immediate availability
  try {
    if (api.config) {
      if (!api.config.models) api.config.models = {};
      if (!api.config.models.providers) api.config.models.providers = {};
      api.config.models.providers.manifest = providerConfig;

      if (!api.config.agents) api.config.agents = {};
      if (!api.config.agents.defaults) api.config.agents.defaults = {};
      if (!api.config.agents.defaults.models) api.config.agents.defaults.models = {};

      const rtModels = api.config.agents.defaults.models;
      if (Array.isArray(rtModels)) {
        if (!rtModels.includes("manifest/auto")) rtModels.push("manifest/auto");
      } else if (typeof rtModels === "object") {
        if (!("manifest/auto" in rtModels)) rtModels["manifest/auto"] = {};
      }
    }
    logger.debug("[manifest] Injected provider into runtime config");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`[manifest] Could not inject runtime config: ${msg}`);
  }
}

/**
 * Injects a placeholder auth profile for the `manifest` provider in each
 * agent's auth-profiles.json.
 */
export function injectAuthProfile(
  apiKey: string,
  logger: PluginLogger,
): void {
  const agentsDir = join(OPENCLAW_DIR, "agents");
  if (!existsSync(agentsDir)) {
    logger.debug("[manifest] No agents directory found, skipping auth profile injection");
    return;
  }

  const profileEntry = {
    type: "api_key",
    provider: "manifest",
    key: apiKey,
  };

  let injected = 0;
  try {
    const agentDirs = readdirSync(agentsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const dir of agentDirs) {
      const profilePath = join(agentsDir, dir.name, "agent", "auth-profiles.json");
      const profileDir = dirname(profilePath);

      if (!existsSync(profileDir)) continue;

      const data = readJsonSafe(profilePath);
      if (!data.version) data.version = 1;
      if (!data.profiles) data.profiles = {};

      const existing = data.profiles["manifest:default"];
      if (existing && existing.key === apiKey) continue;

      data.profiles["manifest:default"] = profileEntry;
      atomicWriteJson(profilePath, data);
      injected++;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`[manifest] Auth profile injection error: ${msg}`);
  }

  if (injected > 0) {
    logger.debug(`[manifest] Injected auth profile into ${injected} agent(s)`);
  }
}

/**
 * Checks whether a healthy Manifest server is already running on the given
 * host:port by sending a GET /api/v1/health request.
 */
export async function checkExistingServer(
  host: string,
  port: number,
): Promise<boolean> {
  try {
    const res = await fetch(`http://${host}:${port}/api/v1/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function registerLocalMode(
  api: any,
  config: ManifestConfig,
  logger: PluginLogger,
) {
  const port = config.port;
  const host = config.host;
  const apiKey = loadOrGenerateApiKey();
  const dbPath = join(CONFIG_DIR, "manifest.db");

  logger.debug("[manifest] Local mode — starting embedded server...");

  // Inject provider config BEFORE routing registration
  injectProviderConfig(api, `http://${host}:${port}/v1`, apiKey, logger);
  injectAuthProfile(apiKey, logger);

  // Load the embedded server module
  let serverModule: { start: (opts: Record<string, unknown>) => Promise<unknown>; version?: string };
  try {
    serverModule = require("./server");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      "[manifest] Failed to load embedded server.\n" +
        `  Error: ${msg}\n` +
        "  This is a packaging error — please reinstall the manifest plugin.",
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
  registerRouting(api, localConfig, logger);

  if (typeof api.registerTool === "function") {
    registerTools(api, localConfig, logger);
  }
  registerCommand(api, localConfig, logger);

  logger.info(`[manifest] 🦚 View your Manifest Dashboard -> http://${host}:${port}`);

  api.registerService({
    id: "manifest-local",
    start: async () => {
      try {
        await serverModule.start({ port, host, dbPath, quiet: true });
        logger.info(`[manifest] Local server running on http://${host}:${port}`);
        logger.info(`[manifest]   Dashboard: http://${host}:${port}`);
        logger.info(`[manifest]   DB: ${dbPath}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("EADDRINUSE") || msg.includes("address already in use")) {
          const isManifest = await checkExistingServer(host, port);
          if (isManifest) {
            logger.info(`[manifest] Reusing existing server at http://${host}:${port}`);
          } else {
            logger.error(
              `[manifest] Port ${port} is already in use by another process.\n` +
                `  Change it with: openclaw config set plugins.entries.manifest.config.port ${port + 1}\n` +
                `  Then restart the gateway.`,
            );
          }
        } else {
          logger.error(
            `[manifest] Failed to start local server: ${msg}\n` +
              `  Try reinstalling: openclaw plugins install manifest\n` +
              `  Then restart: openclaw gateway restart`,
          );
        }
      }
    },
    stop: async () => {
      await shutdownTelemetry(logger);
    },
  });
}
