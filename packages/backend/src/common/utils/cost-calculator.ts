import { PricingEntry, PricingTimeTier } from '../../model-prices/model-pricing-cache.service';

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
  /**
   * USD cost reported by the upstream provider in the response usage block.
   * Used for subscription providers that debit a quota/balance per request
   * (for example NousResearch Portal) instead of being flat-fee unlimited.
   */
  reportedCostUsd?: number | null;
  /**
   * Billing timestamp used to resolve time-of-day pricing tiers (peak/off-peak
   * providers like DeepSeek V4). Pass the request start when available;
   * defaults to the moment of computation, which for proxy traffic is within
   * seconds of the response.
   */
  at?: Date;
}

/**
 * Minutes since UTC midnight for a "HH:MM" string, or null when malformed.
 * Tier windows are validated upstream, so null only guards corrupted data.
 */
function toUtcMinutes(time: string | undefined): number | null {
  if (!time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

/** True when `minutes` falls inside a "HH:MM-HH:MM" window (end exclusive, wraps midnight). */
function windowMatches(window: string, minutes: number): boolean {
  const [start, end] = window.split('-').map(toUtcMinutes);
  if (start == null || end == null) return false;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

/**
 * The time tier whose windows contain `at`, if any. A matching tier replaces
 * the base prices outright (tiers never compose with the base cost).
 */
function resolveTimeTier(pricing: PricingEntry, at: Date): PricingTimeTier | undefined {
  const tiers = pricing.time_tiers;
  if (!tiers || tiers.length === 0) return undefined;
  const minutes = at.getUTCHours() * 60 + at.getUTCMinutes();
  return tiers.find((tier) => tier.windows.some((window) => windowMatches(window, minutes)));
}

/**
 * Computes the USD cost for a set of tokens given a pricing entry.
 *
 * Returns:
 * - `reportedCostUsd` when subscription usage includes a provider-reported
 *   non-negative USD cost (NousResearch Portal pattern)
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
    if (input.reportedCostUsd != null && input.reportedCostUsd >= 0) {
      return input.reportedCostUsd;
    }
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

  // A time tier that matches the billing timestamp replaces the base prices
  // (peak-hour billing); a tier missing its own input/output prices is
  // ignored rather than half-applied.
  const timeTier = resolveTimeTier(pricing, input.at ?? new Date());
  const effective =
    timeTier != null &&
    timeTier.input_price_per_token != null &&
    timeTier.output_price_per_token != null
      ? timeTier
      : pricing;

  const inputPrice = Number(effective.input_price_per_token);
  const outputPrice = Number(effective.output_price_per_token);
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
    effective.cache_read_price_per_token != null
      ? Number(effective.cache_read_price_per_token)
      : inputPrice;
  const cacheWritePrice =
    effective.cache_write_price_per_token != null
      ? Number(effective.cache_write_price_per_token)
      : inputPrice;

  const cost =
    uncachedInputTokens * inputPrice +
    cacheReadTokens * cacheReadPrice +
    cacheCreationTokens * cacheWritePrice +
    input.outputTokens * outputPrice;

  return cost < 0 ? null : cost;
}
