import type { UserProvider } from '../../entities/user-provider.entity';
import type { DiscoveredModel } from '../../model-discovery/model-fetcher';

export interface BaselineCostResult {
  modelId: string;
  cost: number;
}

export function computeBaselineCost(
  providers: UserProvider[],
  inputTokens: number,
  outputTokens: number,
): BaselineCostResult | null {
  const model = pickCheapestReasoningModel(providers);
  if (!model) return null;

  const cost = inputTokens * model.inputPricePerToken! + outputTokens * model.outputPricePerToken!;

  return { modelId: model.id, cost: cost < 0 ? 0 : cost };
}

export function pickCheapestReasoningModel(providers: UserProvider[]): DiscoveredModel | null {
  const allModels: DiscoveredModel[] = [];

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
      if (
        m &&
        typeof m.inputPricePerToken === 'number' &&
        typeof m.outputPricePerToken === 'number' &&
        m.inputPricePerToken > 0 &&
        m.outputPricePerToken > 0
      ) {
        allModels.push(m);
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
