/* eslint-disable @typescript-eslint/no-require-imports */
import {
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  openSync,
  closeSync,
  unlinkSync,
} from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { randomBytes } from 'crypto';
import { PluginLogger } from './types';
import { loadJsonFile } from './json-file';

const API_KEY_PREFIX = 'mnfst_';
const CONFIG_DIR = join(homedir(), '.openclaw', 'manifest');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const LOCK_FILE = join(CONFIG_DIR, '.config.lock');
const OPENCLAW_DIR = join(homedir(), '.openclaw');
const OPENCLAW_CONFIG = join(OPENCLAW_DIR, 'openclaw.json');
const HEALTH_TIMEOUT_MS = 3000;

/* eslint-disable @typescript-eslint/no-explicit-any */

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

function withFileLock<T>(fn: () => T): T {
  let fd: number | null = null;
  try {
    fd = openSync(LOCK_FILE, 'wx');
  } catch {
    // Lock exists or can't be acquired — proceed without lock (best-effort)
    return fn();
  }
  try {
    return fn();
  } finally {
    closeSync(fd);
    try {
      unlinkSync(LOCK_FILE);
    } catch {
      // Ignore cleanup errors
    }
  }
}

export function loadOrGenerateApiKey(): string {
  ensureConfigDir();

  return withFileLock(() => {
    if (existsSync(CONFIG_FILE)) {
      const data = loadJsonFile(CONFIG_FILE);
      if (data.apiKey && data.apiKey.startsWith(API_KEY_PREFIX)) {
        return data.apiKey;
      }
    }

    const key = `${API_KEY_PREFIX}local_${randomBytes(24).toString('hex')}`;
    const existing = loadJsonFile(CONFIG_FILE);
    writeFileSync(CONFIG_FILE, JSON.stringify({ ...existing, apiKey: key }, null, 2), {
      mode: 0o600,
    });
    return key;
  });
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

export function injectProviderConfig(
  api: any,
  baseUrl: string,
  apiKey: string,
  logger: PluginLogger,
): void {
  const providerConfig = {
    baseUrl,
    api: 'openai-completions',
    apiKey,
    models: [{ id: 'auto', name: 'auto' }],
  };

  try {
    const config = loadJsonFile(OPENCLAW_CONFIG);

    if (!config.models) config.models = {};
    if (!config.models.providers) config.models.providers = {};
    config.models.providers.manifest = providerConfig;

    if (!config.agents) config.agents = {};
    if (!config.agents.defaults) config.agents.defaults = {};
    if (!config.agents.defaults.models) config.agents.defaults.models = {};

    const models = config.agents.defaults.models;
    if (Array.isArray(models)) {
      if (!models.includes('manifest/auto')) models.push('manifest/auto');
    } else if (typeof models === 'object') {
      if (!('manifest/auto' in models)) models['manifest/auto'] = {};
    }

    atomicWriteJson(OPENCLAW_CONFIG, config);
    logger.debug('[manifest] Wrote provider config to openclaw.json');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`[manifest] Could not write openclaw.json: ${msg}`);
  }

  try {
    const agentsDir = join(OPENCLAW_DIR, 'agents');
    if (existsSync(agentsDir)) {
      const agentDirs = readdirSync(agentsDir, { withFileTypes: true }).filter((d) =>
        d.isDirectory(),
      );

      for (const dir of agentDirs) {
        const modelsPath = join(agentsDir, dir.name, 'agent', 'models.json');
        if (!existsSync(modelsPath)) continue;

        const data = loadJsonFile(modelsPath);
        if (!data.providers?.manifest) continue;

        delete data.providers.manifest;
        atomicWriteJson(modelsPath, data);
      }
    }
  } catch {
    // Stale model cleanup is best-effort
  }

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
        if (!rtModels.includes('manifest/auto')) rtModels.push('manifest/auto');
      } else if (typeof rtModels === 'object') {
        if (!('manifest/auto' in rtModels)) rtModels['manifest/auto'] = {};
      }
    }
  } catch {
    // Runtime config injection is best-effort
  }
}

export function injectAuthProfile(apiKey: string, logger: PluginLogger): void {
  const agentsDir = join(OPENCLAW_DIR, 'agents');
  if (!existsSync(agentsDir)) return;

  const profileEntry = { type: 'api_key', provider: 'manifest', key: apiKey };

  try {
    const agentDirs = readdirSync(agentsDir, { withFileTypes: true }).filter((d) =>
      d.isDirectory(),
    );

    for (const dir of agentDirs) {
      const profilePath = join(agentsDir, dir.name, 'agent', 'auth-profiles.json');
      if (!existsSync(dirname(profilePath))) continue;

      const data = loadJsonFile(profilePath);
      if (!data.version) data.version = 1;
      if (!data.profiles) data.profiles = {};

      const existing = data.profiles['manifest:default'];
      if (existing && existing.key === apiKey) continue;

      data.profiles['manifest:default'] = profileEntry;
      atomicWriteJson(profilePath, data);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`[manifest] Auth profile injection error: ${msg}`);
  }
}

export async function checkExistingServer(host: string, port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://${host}:${port}/api/v1/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const body: unknown = await res.json();
    return (
      body !== null &&
      typeof body === 'object' &&
      'status' in body &&
      (body as Record<string, unknown>).status === 'healthy'
    );
  } catch {
    return false;
  }
}

export function registerLocalMode(api: any, port: number, host: string, logger: PluginLogger) {
  const apiKey = loadOrGenerateApiKey();
  const dbPath = join(CONFIG_DIR, 'manifest.db');

  logger.debug('[manifest] Starting embedded server...');

  injectProviderConfig(api, `http://${host}:${port}/v1`, apiKey, logger);
  injectAuthProfile(apiKey, logger);

  let serverModule: {
    start: (opts: Record<string, unknown>) => Promise<unknown>;
    version?: string;
  };
  try {
    serverModule = require('./server');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      '[manifest] Failed to load embedded server.\n' +
        `  Error: ${msg}\n` +
        '  This is a packaging error — please reinstall the manifest plugin.',
    );
    return;
  }

  api.registerService({
    id: 'manifest',
    start: async () => {
      logger.debug('[manifest] Service start callback invoked');
      const alreadyRunning = await checkExistingServer(host, port);
      if (alreadyRunning) {
        logger.info(`[manifest] Reusing existing server at http://${host}:${port}`);
        return;
      }

      try {
        await serverModule.start({ port, host, dbPath, quiet: true });

        const verified = await checkExistingServer(host, port);
        if (verified) {
          logger.info(`[manifest] Dashboard -> http://${host}:${port}`);
          logger.info(`[manifest]   DB: ${dbPath}`);
        } else {
          const warnFn = logger.warn ?? logger.info;
          warnFn(
            `[manifest] Server started but health check failed.\n` +
              `  The dashboard may not be accessible at http://${host}:${port}`,
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('EADDRINUSE') || msg.includes('address already in use')) {
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
  });
}
