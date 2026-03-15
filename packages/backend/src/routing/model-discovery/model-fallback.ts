import { DiscoveredModel } from './model-fetcher';
import {
  OPENROUTER_PREFIX_TO_PROVIDER,
  PROVIDER_BY_ID_OR_ALIAS,
} from '../../common/constants/providers';
import {
  getSubscriptionKnownModels,
  getSubscriptionCapabilities,
} from '../../../../subscription-capabilities';

interface PricingLookup {
  lookupPricing(key: string): {
    input: number;
    output: number;
    contextWindow?: number;
    displayName?: string;
  } | null;
  getAll(): Map<
    string,
    { input: number; output: number; contextWindow?: number; displayName?: string }
  >;
}

/**
 * Find the OpenRouter vendor prefix for a provider ID.
 * E.g. "anthropic" → "anthropic", "gemini" → "google", "qwen" → "qwen"
 */
export function findOpenRouterPrefix(providerId: string): string | null {
  const lower = providerId.toLowerCase();
  if (OPENROUTER_PREFIX_TO_PROVIDER.has(lower)) return lower;

  const entry = PROVIDER_BY_ID_OR_ALIAS.get(lower);
  if (entry) {
    for (const prefix of entry.openRouterPrefixes) {
      if (OPENROUTER_PREFIX_TO_PROVIDER.has(prefix)) return prefix;
    }
  }

  for (const [prefix, displayName] of OPENROUTER_PREFIX_TO_PROVIDER) {
    if (displayName.toLowerCase() === lower) return prefix;
  }
  return null;
}

/**
 * Look up pricing with name normalization variants.
 * Providers use different conventions: Anthropic uses dashes (claude-sonnet-4-6),
 * OpenRouter uses dots (claude-sonnet-4.6). Try both.
 */
export function lookupWithVariants(
  pricingSync: PricingLookup,
  prefix: string,
  modelId: string,
): { input: number; output: number; contextWindow?: number; displayName?: string } | null {
  const exact = pricingSync.lookupPricing(`${prefix}/${modelId}`);
  if (exact) return exact;

  const dotVariant = modelId.replace(/-(\d+)-(\d)/g, '-$1.$2');
  if (dotVariant !== modelId) {
    const dotResult = pricingSync.lookupPricing(`${prefix}/${dotVariant}`);
    if (dotResult) return dotResult;
  }

  const dashVariant = modelId.replace(/\.(\d)/g, '-$1');
  if (dashVariant !== modelId) {
    const dashResult = pricingSync.lookupPricing(`${prefix}/${dashVariant}`);
    if (dashResult) return dashResult;
  }

  const noDate = modelId.replace(/-\d{8}$/, '');
  if (noDate !== modelId) {
    const noDateResult = pricingSync.lookupPricing(`${prefix}/${noDate}`);
    if (noDateResult) return noDateResult;

    const noDateDot = noDate.replace(/-(\d+)-(\d)/g, '-$1.$2');
    if (noDateDot !== noDate) {
      const noDateDotResult = pricingSync.lookupPricing(`${prefix}/${noDateDot}`);
      if (noDateDotResult) return noDateDotResult;
    }
  }

  return null;
}

/**
 * Build a fallback model list from OpenRouter cache
 * for providers whose native /models API is unavailable.
 */
export function buildFallbackModels(
  pricingSync: PricingLookup | null,
  providerId: string,
): DiscoveredModel[] {
  if (!pricingSync) return [];
  const models: DiscoveredModel[] = [];
  const seen = new Set<string>();

  const orPrefix = findOpenRouterPrefix(providerId);
  if (!orPrefix) return [];

  for (const [fullId, entry] of pricingSync.getAll()) {
    if (!fullId.startsWith(`${orPrefix}/`)) continue;
    const modelId = fullId.substring(orPrefix.length + 1);
    if (seen.has(modelId)) continue;
    seen.add(modelId);
    models.push({
      id: modelId,
      displayName: entry.displayName || modelId,
      provider: providerId,
      contextWindow: entry.contextWindow ?? 128000,
      inputPricePerToken: entry.input,
      outputPricePerToken: entry.output,
      capabilityReasoning: false,
      capabilityCode: false,
      qualityScore: 3,
    });
  }

  return models;
}

/**
 * Build a curated fallback model list for subscription providers without a token.
 * Uses knownModels prefixes from subscription-capabilities to filter the OpenRouter cache,
 * and applies capability restrictions (e.g., context window caps).
 */
export function buildSubscriptionFallbackModels(
  pricingSync: PricingLookup | null,
  providerId: string,
): DiscoveredModel[] {
  const knownPrefixes = getSubscriptionKnownModels(providerId);
  if (!knownPrefixes || !pricingSync) return [];

  const orPrefix = findOpenRouterPrefix(providerId);
  if (!orPrefix) return [];

  const capabilities = getSubscriptionCapabilities(providerId);
  const models: DiscoveredModel[] = [];
  const seen = new Set<string>();

  for (const [fullId, entry] of pricingSync.getAll()) {
    if (!fullId.startsWith(`${orPrefix}/`)) continue;
    const modelId = fullId.substring(orPrefix.length + 1);
    if (!knownPrefixes.some((p: string) => modelId.startsWith(p))) continue;
    if (seen.has(modelId)) continue;
    seen.add(modelId);

    let contextWindow = entry.contextWindow ?? 128000;
    if (capabilities?.maxContextWindow && contextWindow > capabilities.maxContextWindow) {
      contextWindow = capabilities.maxContextWindow;
    }

    models.push({
      id: modelId,
      displayName: entry.displayName || modelId,
      provider: providerId,
      contextWindow,
      inputPricePerToken: entry.input,
      outputPricePerToken: entry.output,
      capabilityReasoning: false,
      capabilityCode: false,
      qualityScore: 3,
    });
  }

  return models;
}
