import { DiscoveredModel } from './model-fetcher';
import {
  OPENROUTER_PREFIX_TO_PROVIDER,
  PROVIDER_BY_ID_OR_ALIAS,
} from '../../common/constants/providers';
import {
  getSubscriptionKnownModels,
  getSubscriptionCapabilities,
} from '../../../../subscription-capabilities';
import { normalizeAnthropicShortModelId } from '../../common/utils/anthropic-model-id';

interface PricingLookup {
  lookupPricing(key: string): {
    input: number;
    output: number;
    contextWindow?: number;
    displayName?: string;
  } | null;
  getAll(): ReadonlyMap<
    string,
    { input: number; output: number; contextWindow?: number; displayName?: string }
  >;
}

function normalizeProviderModelId(providerId: string, modelId: string): string {
  return providerId.toLowerCase() === 'anthropic'
    ? normalizeAnthropicShortModelId(modelId)
    : modelId;
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
 *
 * When `confirmedModels` is provided and non-empty, only models that exist
 * in the confirmed set are included. This filters out phantom models that
 * OpenRouter lists but the provider's native API doesn't actually serve.
 * When null or empty, all OpenRouter models for the provider are returned
 * (graceful degradation for fresh installs with no native data yet).
 */
export function buildFallbackModels(
  pricingSync: PricingLookup | null,
  providerId: string,
  confirmedModels?: ReadonlySet<string> | null,
): DiscoveredModel[] {
  if (!pricingSync) return [];
  const models: DiscoveredModel[] = [];
  const seen = new Set<string>();
  const hasConfirmed = confirmedModels != null && confirmedModels.size > 0;

  const orPrefix = findOpenRouterPrefix(providerId);
  if (!orPrefix) return [];

  for (const [fullId, entry] of pricingSync.getAll()) {
    if (!fullId.startsWith(`${orPrefix}/`)) continue;
    const modelId = normalizeProviderModelId(providerId, fullId.substring(orPrefix.length + 1));
    if (seen.has(modelId)) continue;

    if (hasConfirmed && !confirmedModels!.has(modelId.toLowerCase())) continue;

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
 * Any knownModels not found in OpenRouter are added directly as zero-cost entries.
 */
export function buildSubscriptionFallbackModels(
  pricingSync: PricingLookup | null,
  providerId: string,
): DiscoveredModel[] {
  const knownPrefixes = getSubscriptionKnownModels(providerId);
  if (!knownPrefixes) return [];
  const normalizedKnownPrefixes = knownPrefixes.map((modelId) => modelId.toLowerCase());

  const capabilities = getSubscriptionCapabilities(providerId);
  const models: DiscoveredModel[] = [];
  const seen = new Set<string>();

  const orPrefix = pricingSync ? findOpenRouterPrefix(providerId) : null;

  if (pricingSync && orPrefix) {
    for (const [fullId, entry] of pricingSync.getAll()) {
      if (!fullId.startsWith(`${orPrefix}/`)) continue;
      const modelId = normalizeProviderModelId(providerId, fullId.substring(orPrefix.length + 1));
      if (!normalizedKnownPrefixes.some((p: string) => modelId.toLowerCase().startsWith(p))) {
        continue;
      }
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
  }

  // Add any knownModels not already covered by discovered models.
  // A knownModel is "covered" if any discovered model starts with it as a prefix
  // (e.g., "claude-opus-4" is covered by "claude-opus-4-20260301").
  const defaultCtx = capabilities?.maxContextWindow ?? 200000;
  for (const modelId of knownPrefixes) {
    const lowerModelId = modelId.toLowerCase();
    const covered = models.some((m) => {
      const lowerDiscovered = m.id.toLowerCase();
      return lowerDiscovered === lowerModelId || lowerDiscovered.startsWith(`${lowerModelId}-`);
    });
    if (covered) continue;
    models.push({
      id: modelId,
      displayName: modelId,
      provider: providerId,
      contextWindow: defaultCtx,
      inputPricePerToken: 0,
      outputPricePerToken: 0,
      capabilityReasoning: false,
      capabilityCode: false,
      qualityScore: 3,
    });
  }

  return models;
}

/**
 * Supplement discovered models with knownModels from subscription-capabilities.
 * Ensures subscription users always have the known models available as selectable options,
 * even if the live API or OpenRouter cache didn't return them.
 */
export function supplementWithKnownModels(
  raw: DiscoveredModel[],
  providerId: string,
): DiscoveredModel[] {
  const knownModels = getSubscriptionKnownModels(providerId);
  if (!knownModels) return raw;

  const capabilities = getSubscriptionCapabilities(providerId);
  const defaultCtx = capabilities?.maxContextWindow ?? 200000;

  for (const modelId of knownModels) {
    const lowerModelId = modelId.toLowerCase();
    // Skip if this model or a more specific version (e.g., with date suffix) already exists
    const covered = raw.some((m) => {
      const lowerDiscovered = m.id.toLowerCase();
      return lowerDiscovered === lowerModelId || lowerDiscovered.startsWith(`${lowerModelId}-`);
    });
    if (covered) continue;
    raw.push({
      id: modelId,
      displayName: modelId,
      provider: providerId,
      contextWindow: defaultCtx,
      inputPricePerToken: 0,
      outputPricePerToken: 0,
      capabilityReasoning: false,
      capabilityCode: false,
      qualityScore: 3,
    });
  }

  return raw;
}
