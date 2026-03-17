import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { PluginLogger } from './telemetry';
import { supportsSubscriptionProvider } from '../../subscription-capabilities';
import { loadJsonFile } from './json-file';

const OPENCLAW_DIR = join(homedir(), '.openclaw');

interface AuthProfileEntry {
  type: string;
  provider: string;
  key?: string;
  access_token?: string;
}

export interface SubscriptionProvider {
  /** OpenClaw provider id (e.g. "anthropic", "openai-codex", "google-gemini") */
  openclawId: string;
  /** Manifest-compatible provider id (e.g. "anthropic", "openai", "gemini") */
  manifestId: string;
  /** Auth type in OpenClaw (e.g. "oauth", "setup_token", "device_login") */
  authType: string;
}

/**
 * Map OpenClaw provider names from auth-profiles to Manifest provider IDs.
 * OpenClaw uses names like "openai-codex", "google-gemini", "github-copilot"
 * while Manifest uses simpler IDs like "openai", "gemini".
 */
const OPENCLAW_TO_MANIFEST: Record<string, string> = {
  anthropic: 'anthropic',
  'openai-codex': 'openai',
  openai: 'openai',
  'google-gemini': 'gemini',
  'google-antigravity': 'gemini',
  google: 'gemini',
  gemini: 'gemini',
  'github-copilot': 'openai', // Copilot uses GPT models
  qwen: 'qwen',
  'qwen-portal': 'qwen',
  moonshot: 'moonshot',
  kimi: 'moonshot',
  minimax: 'minimax',
  'minimax-portal': 'minimax',
};

/**
 * Scans all OpenClaw agent auth-profiles.json files to discover
 * providers authenticated via subscription (OAuth, setup-token, device-login).
 *
 * Returns deduplicated list of subscription providers mapped to Manifest IDs.
 */
export function discoverSubscriptionProviders(logger: PluginLogger): SubscriptionProvider[] {
  const agentsDir = join(OPENCLAW_DIR, 'agents');
  if (!existsSync(agentsDir)) {
    logger.debug('[manifest] No agents directory, no subscription providers');
    return [];
  }

  const seen = new Map<string, SubscriptionProvider>();

  try {
    const agentDirs = readdirSync(agentsDir, { withFileTypes: true }).filter((d) =>
      d.isDirectory(),
    );

    for (const dir of agentDirs) {
      const profilePath = join(agentsDir, dir.name, 'agent', 'auth-profiles.json');
      const data = loadJsonFile(profilePath);
      if (!data.profiles || typeof data.profiles !== 'object') continue;

      for (const entry of Object.values(data.profiles)) {
        const profile = entry as AuthProfileEntry;

        // Skip API key entries and our own manifest profile
        if (profile.type === 'api_key') continue;
        if (profile.provider === 'manifest') continue;

        const manifestId = OPENCLAW_TO_MANIFEST[profile.provider?.toLowerCase() ?? ''];
        if (!manifestId) {
          logger.debug(`[manifest] Unknown subscription provider: ${profile.provider}`);
          continue;
        }
        if (!supportsSubscriptionProvider(manifestId)) {
          logger.debug(
            `[manifest] Ignoring unsupported subscription provider: ${profile.provider} -> ${manifestId}`,
          );
          continue;
        }

        if (!seen.has(manifestId)) {
          seen.set(manifestId, {
            openclawId: profile.provider,
            manifestId,
            authType: profile.type,
          });
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`[manifest] Error scanning auth profiles: ${msg}`);
  }

  const providers = Array.from(seen.values());
  if (providers.length > 0) {
    logger.info(
      `[manifest] Detected ${providers.length} subscription provider(s): ${providers.map((p) => p.manifestId).join(', ')}`,
    );
  }

  return providers;
}

/**
 * Registers discovered subscription providers with the Manifest backend
 * using the OTLP-authenticated batch endpoint.
 * This allows the routing/tier logic to consider subscription providers
 * alongside API key providers.
 */
export async function registerSubscriptionProviders(
  providers: SubscriptionProvider[],
  endpoint: string,
  apiKey: string,
  logger: PluginLogger,
): Promise<void> {
  if (providers.length === 0) return;

  const baseUrl = endpoint.replace(/\/otlp(\/v1)?\/?$/, '');
  const url = `${baseUrl}/api/v1/routing/subscription-providers`;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        providers: providers.map((p) => ({ provider: p.manifestId })),
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = (await res.json()) as { registered: number };
      logger.info(`[manifest] Registered ${data.registered} subscription provider(s)`);
    } else {
      logger.debug(`[manifest] Failed to register subscription providers: ${res.status}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`[manifest] Error registering subscription providers: ${msg}`);
  }
}
