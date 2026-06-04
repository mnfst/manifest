import { PricingEntry } from '../../model-prices/model-pricing-cache.service';

export interface CostInput {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  model: string | null | undefined;
  pricing: PricingEntry | undefined;
  /**
   * When true, cost is subscription-based and the per-token pricing is
   * ignored. The default is `0` (flat-fee plans like Claude Max or ChatGPT
   * Plus), but providers that publish a per-request rate (OpenCode Go) pass
   * a non-null `perRequestCostUsd` to record the actual dollar value of the
   * single request being logged.
   */
  isSubscription?: boolean;
  /**
   * For subscription providers that bill against a dollar quota on a
   * per-request basis (e.g. OpenCode Go), the fixed USD cost the docs
   * attribute to one request. Ignored unless `isSubscription` is true.
   */
  perRequestCostUsd?: number | null;
}

/**
 * Computes the USD cost for a set of tokens given a pricing entry.
 *
 * Returns:
 * - `perRequestCostUsd` when the usage is subscription-based AND a positive
 *   per-request rate is provided (OpenCode Go pattern)
 * - `0` when the usage is subscription-based with no per-request rate
 *   (flat-fee subscriptions: Claude Max, ChatGPT Plus, GLM Coding, etc.)
 * - `null` when the model is unknown, tokens are zero, or pricing is unavailable
 * - the computed cost otherwise
 */
export function computeTokenCost(input: CostInput): number | null {
  if (!input.model) return null;
  if (input.isSubscription) {
    if (input.perRequestCostUsd != null && input.perRequestCostUsd > 0) {
      return input.perRequestCostUsd;
    }
    return 0;
  }
  if (input.inputTokens === 0 && input.outputTokens === 0) return null;

  const pricing = input.pricing;
  if (!pricing || pricing.input_price_per_token == null || pricing.output_price_per_token == null) {
    return null;
  }

  const inputPrice = Number(pricing.input_price_per_token);
  const outputPrice = Number(pricing.output_price_per_token);
  const cacheReadTokens = Math.min(input.inputTokens, Math.max(0, input.cacheReadTokens ?? 0));
  const cacheCreationTokens = Math.min(
    input.inputTokens - cacheReadTokens,
    Math.max(0, input.cacheCreationTokens ?? 0),
  );
  const uncachedInputTokens = Math.max(
    0,
    input.inputTokens - cacheReadTokens - cacheCreationTokens,
  );
  const cacheReadPrice =
    pricing.cache_read_price_per_token != null
      ? Number(pricing.cache_read_price_per_token)
      : inputPrice;
  const cacheWritePrice =
    pricing.cache_write_price_per_token != null
      ? Number(pricing.cache_write_price_per_token)
      : inputPrice;

  const cost =
    uncachedInputTokens * inputPrice +
    cacheReadTokens * cacheReadPrice +
    cacheCreationTokens * cacheWritePrice +
    input.outputTokens * outputPrice;

  return cost < 0 ? null : cost;
}
