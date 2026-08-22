import type { SubscriptionCapabilities, SubscriptionProviderConfig } from './types';
import { SUBSCRIPTION_PROVIDER_CONFIGS } from './configs';
import { normalizeProviderName, SHARED_PROVIDER_BY_ID_OR_ALIAS } from '../providers';

function normalizeProviderId(providerId: string): string {
  const lower = String(providerId || '')
    .trim()
    .toLowerCase();
  const entry =
    SHARED_PROVIDER_BY_ID_OR_ALIAS.get(lower) ??
    SHARED_PROVIDER_BY_ID_OR_ALIAS.get(normalizeProviderName(lower));
  return entry?.id ?? lower;
}

export function getSubscriptionProviderConfig(
  providerId: string,
): Readonly<SubscriptionProviderConfig> | null {
  return (
    SUBSCRIPTION_PROVIDER_CONFIGS[
      normalizeProviderId(providerId) as keyof typeof SUBSCRIPTION_PROVIDER_CONFIGS
    ] ?? null
  );
}

export function supportsSubscriptionProvider(providerId: string): boolean {
  return getSubscriptionProviderConfig(providerId) !== null;
}

export function getSubscriptionKnownModels(providerId: string): readonly string[] | null {
  const config = getSubscriptionProviderConfig(providerId);
  return config?.knownModels ?? null;
}

export function getSubscriptionKnownModelsMatch(providerId: string): 'prefix' | 'exact' {
  const config = getSubscriptionProviderConfig(providerId);
  return config?.knownModelsMatch ?? 'prefix';
}

export function getSubscriptionCapabilities(
  providerId: string,
): Readonly<SubscriptionCapabilities> | null {
  const config = getSubscriptionProviderConfig(providerId);
  return config?.subscriptionCapabilities ?? null;
}

/**
 * Whether the provider exposes a usage/quota endpoint the backend can poll,
 * so routes on its subscription connections can opt into being skipped while
 * the quota is exhausted. Today: Anthropic, Moonshot (Kimi), OpenAI, MiniMax,
 * and xAI (Grok).
 */
export function supportsQuotaCheck(providerId: string): boolean {
  return getSubscriptionCapabilities(providerId)?.quotaCheck === true;
}
