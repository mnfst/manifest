import type { UserProvider } from '../../entities/user-provider.entity';
import type { DiscoveredModel } from '../../model-discovery/model-fetcher';

export interface BaselineCostResult {
  modelId: string;
  cost: number;
}

export interface PricingLookup {
  getByModel(modelId: string):
    | {
        input_price_per_token: number | null;
        output_price_per_token: number | null;
        provider: string;
        model_name: string;
        display_name: string | null;
      }
    | undefined;
}

export interface CapabilityLookup {
  lookupModel(providerId: string, modelId: string): { reasoning?: boolean } | null;
}

/** Minimal shape shared by TierAssignment, SpecificityAssignment, HeaderTier. */
export interface RoutingSlot {
  override_model: string | null;
  auto_assigned_model?: string | null;
  fallback_models: string[] | null;
}

/**
 * Collect every unique model ID that is actively selected in the routing
 * configuration: tier assignments, specificity assignments, and header tiers.
 * Includes primaries (override or auto-assigned) and all fallbacks.
 */
export function collectRoutedModelIds(slots: RoutingSlot[]): string[] {
  const ids = new Set<string>();
  for (const slot of slots) {
    const primary = slot.override_model ?? slot.auto_assigned_model ?? null;
    if (primary) ids.add(primary);
    if (slot.fallback_models) {
      for (const fb of slot.fallback_models) {
        if (fb) ids.add(fb);
      }
    }
  }
  return [...ids];
}

export function computeBaselineCost(
  providers: UserProvider[],
  routedModelIds: string[],
  inputTokens: number,
  outputTokens: number,
  pricingLookup?: PricingLookup,
): BaselineCostResult | null {
  const model = pickMostExpensiveRoutedModel(providers, routedModelIds, pricingLookup);
  if (!model) return null;

  const cost = inputTokens * model.inputPricePerToken! + outputTokens * model.outputPricePerToken!;

  return { modelId: model.id, cost: cost < 0 ? 0 : cost };
}

/**
 * Among all models actually selected in the user's routing config, find the
 * one with the highest API-key-equivalent price (input + output per token).
 * Subscription/local models are enriched with their real provider pricing so
 * they compete on equal footing with API key models.
 */
export function pickMostExpensiveRoutedModel(
  providers: UserProvider[],
  routedModelIds: string[],
  pricingLookup?: PricingLookup,
): DiscoveredModel | null {
  if (routedModelIds.length === 0) return null;

  const routedSet = new Set(routedModelIds);

  // Build a map of all discovered models from active providers.
  const modelMap = new Map<string, DiscoveredModel>();
  for (const p of providers) {
    if (!p.cached_models || !p.is_active) continue;
    let models: DiscoveredModel[];
    try {
      models = typeof p.cached_models === 'string' ? JSON.parse(p.cached_models) : p.cached_models;
    } catch {
      continue;
    }
    if (!Array.isArray(models)) continue;
    for (const m of models) {
      if (!m || !routedSet.has(m.id)) continue;
      if (modelMap.has(m.id)) continue;
      modelMap.set(m.id, m);
    }
  }

  // Enrich pricing and collect valid candidates.
  const candidates: DiscoveredModel[] = [];
  for (const m of modelMap.values()) {
    let inputPrice = m.inputPricePerToken;
    let outputPrice = m.outputPricePerToken;

    const needsEnrichment =
      typeof inputPrice !== 'number' ||
      typeof outputPrice !== 'number' ||
      inputPrice <= 0 ||
      outputPrice <= 0;

    if (needsEnrichment && pricingLookup) {
      const apiPricing = pricingLookup.getByModel(m.id);
      if (
        apiPricing &&
        apiPricing.input_price_per_token != null &&
        apiPricing.output_price_per_token != null &&
        apiPricing.input_price_per_token > 0 &&
        apiPricing.output_price_per_token > 0
      ) {
        inputPrice = apiPricing.input_price_per_token;
        outputPrice = apiPricing.output_price_per_token;
      }
    }

    if (
      typeof inputPrice === 'number' &&
      typeof outputPrice === 'number' &&
      inputPrice > 0 &&
      outputPrice > 0
    ) {
      candidates.push({
        ...m,
        inputPricePerToken: inputPrice,
        outputPricePerToken: outputPrice,
      });
    }
  }

  if (candidates.length === 0) {
    // No routed models found in providers — try pricing lookup directly
    // for models that may only exist in the global pricing cache.
    if (pricingLookup) {
      return pickMostExpensiveFromPricingLookup(routedModelIds, pricingLookup);
    }
    return null;
  }

  // Sort descending by total price, pick most expensive.
  candidates.sort(
    (a, b) =>
      b.inputPricePerToken! +
      b.outputPricePerToken! -
      (a.inputPricePerToken! + a.outputPricePerToken!),
  );
  return candidates[0]!;
}

/**
 * Last-resort: when no routed model was found in providers' cached_models,
 * try to resolve pricing from the global cache (e.g. for models that were
 * assigned but whose provider was since disconnected).
 */
function pickMostExpensiveFromPricingLookup(
  routedModelIds: string[],
  pricingLookup: PricingLookup,
): DiscoveredModel | null {
  let best: DiscoveredModel | null = null;
  let bestTotal = -1;

  for (const id of routedModelIds) {
    const pricing = pricingLookup.getByModel(id);
    if (
      !pricing ||
      pricing.input_price_per_token == null ||
      pricing.output_price_per_token == null ||
      pricing.input_price_per_token <= 0 ||
      pricing.output_price_per_token <= 0
    ) {
      continue;
    }
    const total = pricing.input_price_per_token + pricing.output_price_per_token;
    if (total > bestTotal) {
      bestTotal = total;
      best = {
        id,
        displayName: pricing.display_name ?? id,
        provider: pricing.provider ?? 'unknown',
        contextWindow: 0,
        inputPricePerToken: pricing.input_price_per_token,
        outputPricePerToken: pricing.output_price_per_token,
        capabilityReasoning: false,
        capabilityCode: false,
        qualityScore: 0,
      };
    }
  }
  return best;
}
