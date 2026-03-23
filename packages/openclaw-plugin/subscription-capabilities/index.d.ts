export interface SubscriptionCapabilities {
  maxContextWindow: number;
  supportsPromptCaching: boolean;
  supportsBatching: boolean;
}

export interface SubscriptionProviderConfig {
  supportsSubscription: true;
  subscriptionLabel: string;
  subscriptionKeyPlaceholder?: string;
  subscriptionCommand?: string;
  subscriptionAuthMode?: 'popup_oauth' | 'device_code' | 'token';
  subscriptionTokenPrefix?: string;
  subscriptionOAuth?: boolean;
  knownModels?: readonly string[];
  knownModelMatchMode?: 'prefix' | 'exact';
  catalogMode?: 'full' | 'known_only';
  alwaysQualifyModelIds?: boolean;
  subscriptionCapabilities?: Readonly<SubscriptionCapabilities>;
}

export declare const SUBSCRIPTION_PROVIDER_CONFIGS: Readonly<
  Record<string, Readonly<SubscriptionProviderConfig>>
>;

export declare const SUPPORTED_SUBSCRIPTION_PROVIDER_IDS: readonly string[];

export declare function getSubscriptionProviderConfig(
  providerId: string,
): Readonly<SubscriptionProviderConfig> | null;

export declare function supportsSubscriptionProvider(providerId: string): boolean;

export declare function getSubscriptionKnownModels(
  providerId: string,
): readonly string[] | null;

export declare function getSubscriptionKnownModelMatchMode(
  providerId: string,
): 'prefix' | 'exact';

export declare function getSubscriptionCatalogMode(
  providerId: string,
): 'full' | 'known_only';

export declare function shouldQualifySubscriptionModelIds(providerId: string): boolean;

export declare function getSubscriptionCapabilities(
  providerId: string,
): Readonly<SubscriptionCapabilities> | null;
