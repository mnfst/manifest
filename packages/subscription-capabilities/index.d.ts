export interface SubscriptionProviderConfig {
  supportsSubscription: true;
  subscriptionLabel: string;
  subscriptionKeyPlaceholder: string;
  subscriptionCommand?: string;
  subscriptionTokenPrefix?: string;
}

export declare const SUBSCRIPTION_PROVIDER_CONFIGS: Readonly<
  Record<string, Readonly<SubscriptionProviderConfig>>
>;

export declare const SUPPORTED_SUBSCRIPTION_PROVIDER_IDS: readonly string[];

export declare function getSubscriptionProviderConfig(
  providerId: string,
): Readonly<SubscriptionProviderConfig> | null;

export declare function supportsSubscriptionProvider(providerId: string): boolean;

declare const subscriptionCapabilities: {
  SUBSCRIPTION_PROVIDER_CONFIGS: typeof SUBSCRIPTION_PROVIDER_CONFIGS;
  SUPPORTED_SUBSCRIPTION_PROVIDER_IDS: typeof SUPPORTED_SUBSCRIPTION_PROVIDER_IDS;
  getSubscriptionProviderConfig: typeof getSubscriptionProviderConfig;
  supportsSubscriptionProvider: typeof supportsSubscriptionProvider;
};

export default subscriptionCapabilities;
