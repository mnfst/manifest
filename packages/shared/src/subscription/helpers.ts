import type { SubscriptionCapabilities, SubscriptionProviderConfig } from './types';
import { SUBSCRIPTION_PROVIDER_CONFIGS } from './configs';

function normalizeProviderId(providerId: string): string {
  return String(providerId || '').toLowerCase();
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
