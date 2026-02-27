import { ModelPricing } from '../entities/model-pricing.entity';

/**
 * Models where data signals alone cannot determine the correct quality tier.
 * These encode editorial benchmark-level judgments that price + capabilities
 * cannot derive. Kept minimal — only models the formula misclassifies.
 */
export const QUALITY_OVERRIDES: ReadonlyMap<string, number> = new Map([
  // Anthropic mid-tier despite frontier-level price + capabilities
  ['claude-sonnet-4-5-20250929', 4],
  ['claude-sonnet-4-20250514', 4],
  // Expensive code-only models that benchmark as mid-range, not tier-1.5
  ['gpt-4o', 3],
  ['grok-2', 3],
  ['mistral-large', 3],
  ['kimi-k2', 3],
  // Meta-router — computed score from price data doesn't reflect frontier capability
  ['openrouter/auto', 5],
]);

const MINI_VARIANT = /\b(mini|nano|haiku|micro)\b/i;

/**
 * Compute quality_score (1-5) from model data signals.
 *
 * Decision tree based on price tier, capabilities, and context window:
 *   5 = frontier: expensive ($8+/M) with dual capabilities, or code + 1M+ context
 *   4 = tier-1.5: reasoning models $1+/M, or expensive code-only
 *   3 = mid-range: mid-price code models, cheap dual-capability, or reasoning minis
 *   2 = cost-optimized: has code capability
 *   1 = ultra-low: no code, very cheap
 */
export function computeQualityScore(model: Pick<
  ModelPricing,
  'model_name' | 'input_price_per_token' | 'output_price_per_token' |
  'capability_reasoning' | 'capability_code' | 'context_window'
>): number {
  const override = QUALITY_OVERRIDES.get(model.model_name);
  if (override !== undefined) return override;

  const totalPerM =
    (Number(model.input_price_per_token) + Number(model.output_price_per_token)) * 1_000_000;
  const hasReasoning = model.capability_reasoning;
  const hasCode = model.capability_code;
  const hasBoth = hasReasoning && hasCode;
  const bigContext = model.context_window >= 1_000_000;
  const isMini = MINI_VARIANT.test(model.model_name);

  // Zero-price models (local, e.g. Ollama) — score on capabilities only
  if (totalPerM === 0) {
    if (hasBoth && !isMini) return 3;
    if (hasReasoning && !isMini) return 3;
    if (hasReasoning && isMini) return 2;
    if (hasCode) return 2;
    return 1;
  }

  // Q5: Frontier — expensive with strong capabilities
  if (totalPerM >= 8.0 && hasBoth && !isMini) return 5;
  if (totalPerM >= 8.0 && hasCode && bigContext) return 5;

  // Q4: High-capability — reasoning above $1/M (not mini), or expensive code-only
  if (totalPerM >= 1.0 && hasReasoning && !isMini) return 4;
  if (totalPerM >= 8.0 && hasCode) return 4;

  // Q3: Mid-range — mid-price code (not mini), cheap dual-cap, or reasoning minis
  if (totalPerM >= 3.0 && hasCode && !isMini) return 3;
  if (totalPerM >= 0.50 && hasBoth && !isMini) return 3;
  if (hasReasoning && isMini && totalPerM >= 0.50) return 3;

  // Q2: Cost-optimized — has code capability
  if (hasCode) return 2;

  // Q1: Ultra-low — no code capability
  return 1;
}
