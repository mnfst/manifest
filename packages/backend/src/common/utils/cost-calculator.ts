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
   * USD cost reported by the upstream provider in its response usage block
   * (`usage.cost`, as OpenRouter and other gateways emit).
   *
   * This is what the provider says it charged, so it outranks every catalogue
   * estimate — no seller lookup, no stale rate. It is believed from any
   * upstream that reports it, which includes user-defined OpenAI-compatible
   * endpoints; the parser accepts only a non-negative finite number, and that
   * is the whole of the validation.
   */
  reportedCostUsd?: number | null;
  /**
   * True when the model ran on the user's own hardware (Ollama, llama.cpp,
   * LM Studio — `localOnly` in the provider registry). Local inference has no
   * per-token bill, so the cost is a known `0` rather than an unknown `null`.
   */
  isLocalProvider?: boolean;
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
  // A zero-length window matches nothing. Without this, start === end falls
  // into the wrap branch and matches the whole day, letting a malformed
  // upstream band override the base rate around the clock.
  if (start === end) return false;
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
 * Widest value `agent_messages.cost_usd` can hold — `decimal(10, 6)`.
 *
 * A larger number is not an expensive request, it is a provider reporting
 * something other than per-request USD (credits, cents, a running session
 * total). Storing it is not an option: PostgreSQL raises `numeric field
 * overflow`, the insert throws, and the recorder swallows it — costing the
 * whole telemetry row, not just its price. Ignoring the report and estimating
 * from the catalogue keeps the request visible.
 */
const MAX_RECORDABLE_COST_USD = 9999.999999;

/** True when a provider-reported cost is usable and will survive the column. */
function isRecordableReportedCost(reported: number | null | undefined): boolean {
  return reported != null && reported >= 0 && reported <= MAX_RECORDABLE_COST_USD;
}

/**
 * Computes the USD cost for a set of tokens given a pricing entry.
 *
 * Sources are tried most-accurate first, because they are not equally good
 * answers to "what did this request cost":
 *
 * 1. `reportedCostUsd` — what the provider says it charged. Exact, so it wins
 *    outright, for any provider that reports it. Ignored above
 *    `MAX_RECORDABLE_COST_USD`, which is not a real per-request price.
 * 2. `perRequestCostUsd` — a published per-request rate on a subscription
 *    (OpenCode Go pattern); `0` for a flat-fee plan with no such rate
 *    (Claude Max, ChatGPT Plus, GLM Coding).
 * 3. `0` for local inference — free, and known to be free.
 * 4. The token maths below, from the caller's `pricing` entry. An estimate:
 *    it is only as right as the catalogue, and the catalogue only holds the
 *    correct seller's rates when the caller looked them up by provider.
 *
 * Returns `null` when the model is unknown, tokens are zero, or no pricing is
 * available — meaning "not known", which is not the same as free.
 */
export function computeTokenCost(input: CostInput): number | null {
  if (!input.model) return null;
  if (isRecordableReportedCost(input.reportedCostUsd)) {
    return input.reportedCostUsd as number;
  }
  if (input.isSubscription) {
    if (input.perRequestCostUsd != null && input.perRequestCostUsd > 0) {
      return input.perRequestCostUsd;
    }
    return 0;
  }
  if (input.isLocalProvider) return 0;
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
