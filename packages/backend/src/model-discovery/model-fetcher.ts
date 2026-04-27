/**
 * Types for provider-native model discovery.
 *
 * Each provider's /models API is called using a FetcherConfig that describes
 * the endpoint, auth header, and response parser. The result is a list of
 * DiscoveredModel objects cached in user_providers.cached_models.
 */

import type { AuthType } from 'manifest-shared';

export interface DiscoveredModel {
  id: string;
  displayName: string;
  provider: string;
  contextWindow: number;
  inputPricePerToken: number | null;
  outputPricePerToken: number | null;
  capabilityReasoning: boolean;
  capabilityCode: boolean;
  qualityScore: number;
  authType?: AuthType;
}

export interface FetcherConfig {
  /** Base URL for the models endpoint. */
  endpoint: string | ((key: string) => string);
  /** Build the Authorization / auth header(s). */
  buildHeaders: (key: string, authType?: string) => Record<string, string>;
  /** Parse provider-specific response JSON into DiscoveredModel[]. */
  parse: (body: unknown, provider: string) => DiscoveredModel[];
}
