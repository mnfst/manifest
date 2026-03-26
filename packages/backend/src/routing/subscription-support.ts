import { supportsSubscriptionProvider } from '@mnfst/shared';

type ProviderAuthRecord = {
  provider: string;
  auth_type?: 'api_key' | 'subscription' | null;
};

export function isSupportedSubscriptionProvider(provider: string): boolean {
  return supportsSubscriptionProvider(provider);
}

export function isManifestUsableProvider(record: ProviderAuthRecord): boolean {
  return record.auth_type !== 'subscription' || isSupportedSubscriptionProvider(record.provider);
}
