import { writeFileSync, existsSync, mkdirSync, readdirSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { PluginLogger } from './types';
import { loadJsonFile } from './json-file';

const OPENCLAW_DIR = join(homedir(), '.openclaw');
const OPENCLAW_CONFIG = join(OPENCLAW_DIR, 'openclaw.json');

/* eslint-disable @typescript-eslint/no-explicit-any */

function atomicWriteJson(path: string, data: unknown): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const tmp = `${path}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  renameSync(tmp, path);
}

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
    api: 'openai-completions',
    apiKey,
    models: [{ id: 'auto', name: 'auto' }],
  };

  // 1. Write to ~/.openclaw/openclaw.json (atomic write)
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

  // 2. Remove stale manifest entries from per-agent models.json files.
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
        logger.debug(
          `[manifest] Removed stale manifest entry from models.json for agent ${dir.name}`,
        );
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`[manifest] Could not clean agent models.json: ${msg}`);
  }

  // 3. Set runtime config for immediate availability
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
    logger.debug('[manifest] Injected provider into runtime config');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`[manifest] Could not inject runtime config: ${msg}`);
  }
}

/**
 * Injects a placeholder auth profile for the `manifest` provider in each
 * agent's auth-profiles.json.
 */
export function injectAuthProfile(apiKey: string, logger: PluginLogger): void {
  const agentsDir = join(OPENCLAW_DIR, 'agents');
  if (!existsSync(agentsDir)) {
    logger.debug('[manifest] No agents directory found, skipping auth profile injection');
    return;
  }

  const profileEntry = {
    type: 'api_key',
    provider: 'manifest',
    key: apiKey,
  };

  let injected = 0;
  try {
    const agentDirs = readdirSync(agentsDir, { withFileTypes: true }).filter((d) =>
      d.isDirectory(),
    );

    for (const dir of agentDirs) {
      const profilePath = join(agentsDir, dir.name, 'agent', 'auth-profiles.json');
      const profileDir = dirname(profilePath);

      if (!existsSync(profileDir)) continue;

      const data = loadJsonFile(profilePath);
      if (!data.version) data.version = 1;
      if (!data.profiles) data.profiles = {};

      const existing = data.profiles['manifest:default'];
      if (existing && existing.key === apiKey) continue;

      data.profiles['manifest:default'] = profileEntry;
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
