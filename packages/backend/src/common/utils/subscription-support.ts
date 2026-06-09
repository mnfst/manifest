import type { AuthType } from 'manifest-shared';
import { supportsSubscriptionProvider, SHARED_PROVIDER_BY_ID_OR_ALIAS } from 'manifest-shared';

type ProviderAuthRecord = {
  provider: string;
  auth_type?: AuthType | null;
};

/**
 * Resolve a provider ID or alias to its canonical form using the shared provider
 * registry. Returns the canonical ID (e.g. 'gemini' for 'google') or the original
 * input if no match is found.
 */
function resolveCanonicalProviderId(provider: string): string {
  const entry = SHARED_PROVIDER_BY_ID_OR_ALIAS.get(provider.toLowerCase());
  return entry?.id ?? provider.toLowerCase();
}

export function isSupportedSubscriptionProvider(provider: string): boolean {
  return supportsSubscriptionProvider(provider);
}

/**
 * Determines whether a provider record is usable for routing in Manifest.
 *
 * For subscription auth records, this also checks whether the provider is
 * supported by Manifest's subscription system. Provider aliases (e.g. 'google'
 * for 'gemini') are resolved to their canonical form before checking against
 * the subscription config, so records stored with an alias are not incorrectly
 * filtered out.
 */
export function isManifestUsableProvider(record: ProviderAuthRecord): boolean {
  if (record.auth_type !== 'subscription') return true;
  const canonical = resolveCanonicalProviderId(record.provider);
  return isSupportedSubscriptionProvider(canonical);
}
