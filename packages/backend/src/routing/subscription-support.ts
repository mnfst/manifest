import {
  SUPPORTED_SUBSCRIPTION_PROVIDER_IDS,
  supportsSubscriptionProvider,
} from '../../../subscription-capabilities';

type ProviderAuthRecord = {
  provider: string;
  auth_type?: 'api_key' | 'subscription' | null;
};

export const SUPPORTED_SUBSCRIPTION_PROVIDERS = new Set(SUPPORTED_SUBSCRIPTION_PROVIDER_IDS);

export function isSupportedSubscriptionProvider(provider: string): boolean {
  return supportsSubscriptionProvider(provider);
}

export function isManifestUsableProvider(record: ProviderAuthRecord): boolean {
  return record.auth_type !== 'subscription' || isSupportedSubscriptionProvider(record.provider);
}
