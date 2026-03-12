import { ManifestConfig } from './config';
import { PluginLogger } from './telemetry';
import { verifyConnection } from './verify';

interface RoutingSummaryProvider {
  provider: string;
  auth_type: 'api_key' | 'subscription';
}

interface RoutingSummaryTier {
  tier: string;
  model: string | null;
  source: 'auto' | 'override';
  fallback_models: string[];
}

interface RoutingSummaryResponse {
  agentName: string;
  providers: RoutingSummaryProvider[];
  tiers: RoutingSummaryTier[];
}

const ROUTING_SUMMARY_TIMEOUT_MS = 5000;
const TIER_LABELS: Record<string, string> = {
  simple: 'Simple',
  standard: 'Standard',
  complex: 'Complex',
  reasoning: 'Reasoning',
};

function buildAuthHeaders(config: ManifestConfig): Record<string, string> {
  return config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {};
}

function formatAuthType(authType: 'api_key' | 'subscription'): string {
  return authType === 'api_key' ? 'api key' : 'subscription';
}

function formatProviders(providers: RoutingSummaryProvider[]): string {
  if (providers.length === 0) return 'none';
  return providers
    .map((provider) => `${provider.provider} (${formatAuthType(provider.auth_type)})`)
    .join(', ');
}

function formatTier(tier: RoutingSummaryTier): string {
  const label = TIER_LABELS[tier.tier] ?? tier.tier;
  const model = tier.model ?? 'unassigned';
  return `${label} -> ${model} (${tier.source})`;
}

async function fetchRoutingSummary(
  config: ManifestConfig,
  logger: PluginLogger,
): Promise<RoutingSummaryResponse | null> {
  const baseUrl = config.endpoint.replace(/\/otlp(\/v1)?\/?$/, '');

  try {
    const res = await fetch(`${baseUrl}/api/v1/routing/summary`, {
      headers: buildAuthHeaders(config),
      signal: AbortSignal.timeout(ROUTING_SUMMARY_TIMEOUT_MS),
    });

    if (!res.ok) {
      logger.debug(`[manifest] Routing summary unavailable (${res.status})`);
      return null;
    }

    return (await res.json()) as RoutingSummaryResponse;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`[manifest] Routing summary failed (${msg})`);
    return null;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function registerCommand(api: any, config: ManifestConfig, logger: PluginLogger): void {
  if (typeof api.registerCommand !== 'function') {
    logger.debug('[manifest] registerCommand not available, skipping /manifest command');
    return;
  }

  const commandHandler = async () => {
    try {
      const check = await verifyConnection(config);
      const lines = [
        `Mode: ${config.mode}`,
        `Dev mode: ${config.devMode ? 'yes' : 'no'}`,
        `Endpoint reachable: ${check.endpointReachable ? 'yes' : 'no'}`,
        `Auth valid: ${check.authValid ? 'yes' : 'no'}`,
      ];

      const routingSummary =
        check.endpointReachable && check.authValid
          ? await fetchRoutingSummary(config, logger)
          : null;
      const agentName = routingSummary?.agentName ?? check.agentName;

      if (agentName) {
        lines.push(`Agent: ${agentName}`);
      }

      if (routingSummary) {
        lines.push(`Providers: ${formatProviders(routingSummary.providers)}`);
        lines.push('Routing:');
        for (const tier of routingSummary.tiers) {
          lines.push(`  ${formatTier(tier)}`);
        }
      }

      if (check.error) {
        lines.push(`Error: ${check.error}`);
      }
      return lines.join('\n');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Manifest status check failed: ${msg}`;
    }
  };

  api.registerCommand({
    name: 'manifest',
    description: 'Show Manifest plugin status and connection info',
    handler: commandHandler,
    execute: commandHandler,
  });

  logger.debug('[manifest] Registered /manifest command');
}
