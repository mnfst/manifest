import { normalizeProviderName, SHARED_PROVIDER_BY_ID_OR_ALIAS } from 'manifest-shared';
import { isSelfHosted } from './detect-self-hosted';

export const CLOUD_LOCAL_PROVIDER_MESSAGE =
  'Built-in local providers are only available in self-hosted Manifest. On Manifest Cloud, expose the runtime through a public URL or tunnel and connect it as a custom provider.';
export const MANIFEST_CLOUD_ONLY_MESSAGE =
  'The Manifest provider is currently available only on Manifest Cloud.';

export function isLocalOnlyProvider(provider: string): boolean {
  const lower = provider.trim().toLowerCase();
  const entry =
    SHARED_PROVIDER_BY_ID_OR_ALIAS.get(lower) ??
    SHARED_PROVIDER_BY_ID_OR_ALIAS.get(normalizeProviderName(lower));
  return entry?.localOnly === true;
}

export function isCloudOnlyProvider(provider: string): boolean {
  const lower = provider.trim().toLowerCase();
  const entry =
    SHARED_PROVIDER_BY_ID_OR_ALIAS.get(lower) ??
    SHARED_PROVIDER_BY_ID_OR_ALIAS.get(normalizeProviderName(lower));
  return entry?.cloudOnly === true;
}

export function isProviderAvailableForDeployment(provider: string): boolean {
  return isSelfHosted() ? !isCloudOnlyProvider(provider) : !isLocalOnlyProvider(provider);
}

export function filterProvidersForDeployment<T extends { provider: string }>(providers: T[]): T[] {
  const selfHosted = isSelfHosted();
  const isUnavailable = (provider: T) =>
    selfHosted ? isCloudOnlyProvider(provider.provider) : isLocalOnlyProvider(provider.provider);
  if (!providers.some(isUnavailable)) return providers;
  return providers.filter((provider) => !isUnavailable(provider));
}
