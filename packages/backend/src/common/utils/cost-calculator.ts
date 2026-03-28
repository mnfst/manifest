import { PricingEntry } from '../../model-prices/model-pricing-cache.service';

export interface CostInput {
  inputTokens: number;
  outputTokens: number;
  model: string | null | undefined;
  pricing: PricingEntry | undefined;
  /**
   * When true, cost is always 0 (subscription-based usage).
   * Callers determine this from authType or subscription-provider sets.
   */
  isSubscription?: boolean;
}

/**
 * Computes the USD cost for a set of tokens given a pricing entry.
 *
 * Returns:
 * - `0` when the usage is subscription-based
 * - `null` when the model is unknown, tokens are zero, or pricing is unavailable
 * - the computed cost otherwise
 */
export function computeTokenCost(input: CostInput): number | null {
  if (!input.model) return null;
  if (input.isSubscription) return 0;
  if (input.inputTokens === 0 && input.outputTokens === 0) return null;

  const pricing = input.pricing;
  if (!pricing || pricing.input_price_per_token == null || pricing.output_price_per_token == null) {
    return null;
  }

  const cost =
    input.inputTokens * Number(pricing.input_price_per_token) +
    input.outputTokens * Number(pricing.output_price_per_token);

  return cost < 0 ? null : cost;
}
