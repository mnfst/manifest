import type { AuthType } from 'manifest-shared';
import { supportsSubscriptionProvider } from 'manifest-shared';

type ProviderAuthRecord = {
  provider: string;
  auth_type?: AuthType | null;
};

export function isSupportedSubscriptionProvider(provider: string): boolean {
  return supportsSubscriptionProvider(provider);
}

export function isManifestUsableProvider(record: ProviderAuthRecord): boolean {
  return record.auth_type !== 'subscription' || isSupportedSubscriptionProvider(record.provider);
}
