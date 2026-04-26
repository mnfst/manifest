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

export function computeBaselineCost(
  providers: UserProvider[],
  inputTokens: number,
  outputTokens: number,
  pricingLookup?: PricingLookup,
  capabilityLookup?: CapabilityLookup,
): BaselineCostResult | null {
  const model = pickCheapestReasoningModel(providers, pricingLookup, capabilityLookup);
  if (!model) return null;

  const cost = inputTokens * model.inputPricePerToken! + outputTokens * model.outputPricePerToken!;

  return { modelId: model.id, cost: cost < 0 ? 0 : cost };
}

export function pickCheapestReasoningModel(
  providers: UserProvider[],
  pricingLookup?: PricingLookup,
  capabilityLookup?: CapabilityLookup,
): DiscoveredModel | null {
  const allModels: DiscoveredModel[] = [];
  const seen = new Set<string>();

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
      if (!m || seen.has(m.id)) continue;
      seen.add(m.id);

      let inputPrice = m.inputPricePerToken;
      let outputPrice = m.outputPricePerToken;
      let reasoning = m.capabilityReasoning;

      // For models with $0 or missing pricing (subscription/local),
      // look up real API pricing and capabilities from global caches.
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

          // Also enrich capabilities from models.dev using the original provider
          if (capabilityLookup && !reasoning) {
            const providerSlug = apiPricing.provider?.toLowerCase() ?? '';
            // Try multiple name variants to match models.dev entries
            const pricingDisplayName = apiPricing.display_name ?? '';
            const dashified = pricingDisplayName.replace(/\s+/g, '-');
            const caps =
              capabilityLookup.lookupModel(providerSlug, dashified) ??
              capabilityLookup.lookupModel(providerSlug, pricingDisplayName) ??
              capabilityLookup.lookupModel(providerSlug, m.id) ??
              capabilityLookup.lookupModel(providerSlug, m.displayName ?? m.id);
            if (caps?.reasoning) {
              reasoning = true;
            }
          }
        }
      }

      if (
        typeof inputPrice === 'number' &&
        typeof outputPrice === 'number' &&
        inputPrice > 0 &&
        outputPrice > 0
      ) {
        allModels.push({
          ...m,
          inputPricePerToken: inputPrice,
          outputPricePerToken: outputPrice,
          capabilityReasoning: reasoning ?? false,
        });
      }
    }
  }

  if (allModels.length === 0) return null;

  const reasoningCapable = allModels.filter((m) => m.capabilityReasoning === true);

  if (reasoningCapable.length > 0) {
    reasoningCapable.sort(
      (a, b) =>
        a.inputPricePerToken! +
        a.outputPricePerToken! -
        (b.inputPricePerToken! + b.outputPricePerToken!),
    );
    return reasoningCapable[0]!;
  }

  const byQuality = [...allModels].sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0));
  return byQuality[0]!;
}
