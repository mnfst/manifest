import { computeTokenCost } from './cost-calculator';
import { PricingEntry } from '../../model-prices/model-pricing-cache.service';

/**
 * These tests pin the current behavior of `computeTokenCost` when pricing
 * values resolve to non-finite numbers (NaN / Infinity / -Infinity).
 *
 * The function performs `Number(pricing.x_price_per_token)` and then guards
 * the result only with `cost < 0`. Non-finite numbers slip through because:
 *  - `NaN < 0` is `false`
 *  - `Infinity < 0` is `false`
 *  - `-Infinity < 0` is `true` (returns null)
 *
 * Until the source is hardened to reject NaN / +Infinity, these tests
 * document the gap so any future change to the guard is intentional.
 */
describe('computeTokenCost — non-finite pricing edges', () => {
  const basePricing: PricingEntry = {
    model_name: 'gpt-4o',
    provider: 'OpenAI',
    input_price_per_token: 0.0000025,
    output_price_per_token: 0.00001,
    display_name: 'GPT-4o',
  };

  describe('NaN in pricing fields', () => {
    it('returns NaN when input_price_per_token is the literal NaN', () => {
      const nanPricing: PricingEntry = {
        ...basePricing,
        input_price_per_token: Number.NaN,
      };

      const result = computeTokenCost({
        inputTokens: 100,
        outputTokens: 50,
        model: 'gpt-4o',
        pricing: nanPricing,
      });

      // Documented gap: the `cost < 0` guard does NOT reject NaN.
      // Tightening should change this to `.toBeNull()`.
      expect(result).not.toBeNull();
      expect(Number.isNaN(result)).toBe(true);
    });

    it('returns NaN when output_price_per_token is the literal NaN', () => {
      const nanPricing: PricingEntry = {
        ...basePricing,
        output_price_per_token: Number.NaN,
      };

      const result = computeTokenCost({
        inputTokens: 100,
        outputTokens: 50,
        model: 'gpt-4o',
        pricing: nanPricing,
      });

      expect(Number.isNaN(result)).toBe(true);
    });

    it('returns NaN when input_price_per_token is a non-numeric string', () => {
      // Models real-world malformed JSON: a string that Number() turns into NaN.
      const malformed: PricingEntry = {
        ...basePricing,
        input_price_per_token: 'not-a-number' as unknown as number,
      };

      const result = computeTokenCost({
        inputTokens: 100,
        outputTokens: 50,
        model: 'gpt-4o',
        pricing: malformed,
      });

      expect(Number.isNaN(result)).toBe(true);
    });

    it('returns NaN when cache_read_price_per_token resolves to NaN', () => {
      const malformed: PricingEntry = {
        ...basePricing,
        cache_read_price_per_token: 'oops' as unknown as number,
      };

      const result = computeTokenCost({
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 400,
        model: 'gpt-4o',
        pricing: malformed,
      });

      expect(Number.isNaN(result)).toBe(true);
    });

    it('returns NaN when cache_write_price_per_token resolves to NaN', () => {
      const malformed: PricingEntry = {
        ...basePricing,
        cache_write_price_per_token: 'bad' as unknown as number,
      };

      const result = computeTokenCost({
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreationTokens: 200,
        model: 'gpt-4o',
        pricing: malformed,
      });

      expect(Number.isNaN(result)).toBe(true);
    });

    it('returns 0 for subscription even when pricing fields are NaN (short-circuit)', () => {
      // Subscription short-circuit happens before Number() coercion is touched,
      // so the NaN never reaches the math.
      const nanPricing: PricingEntry = {
        ...basePricing,
        input_price_per_token: Number.NaN,
        output_price_per_token: Number.NaN,
      };

      expect(
        computeTokenCost({
          inputTokens: 100,
          outputTokens: 50,
          model: 'gpt-4o',
          pricing: nanPricing,
          isSubscription: true,
        }),
      ).toBe(0);
    });
  });

  describe('Infinity in pricing fields', () => {
    it('returns NaN when input_price_per_token is +Infinity (0 * Inf in fallback cache pricing)', () => {
      // inputPrice = +Inf leaks into cacheReadPrice / cacheWritePrice fallbacks.
      // Both cache token counts default to 0, so `0 * Infinity = NaN` poisons
      // the sum. The `cost < 0` guard cannot reject NaN.
      const infinitePricing: PricingEntry = {
        ...basePricing,
        input_price_per_token: Number.POSITIVE_INFINITY,
      };

      const result = computeTokenCost({
        inputTokens: 100,
        outputTokens: 50,
        model: 'gpt-4o',
        pricing: infinitePricing,
      });

      expect(Number.isNaN(result)).toBe(true);
    });

    it('returns +Infinity when input_price_per_token is +Infinity and cache prices are explicitly finite', () => {
      // Pinning down the path where +Infinity is preserved: supply explicit
      // finite cache prices so the `0 * cacheReadPrice` term is `0 * finite = 0`
      // instead of `0 * Infinity = NaN`. The output term then dominates.
      const infinitePricing: PricingEntry = {
        ...basePricing,
        input_price_per_token: Number.POSITIVE_INFINITY,
        cache_read_price_per_token: 0,
        cache_write_price_per_token: 0,
      };

      const result = computeTokenCost({
        inputTokens: 100,
        outputTokens: 50,
        model: 'gpt-4o',
        pricing: infinitePricing,
      });

      // Documented gap: `Infinity < 0` is false, so the guard lets +Infinity through.
      expect(result).toBe(Number.POSITIVE_INFINITY);
      expect(Number.isFinite(result)).toBe(false);
    });

    it('returns Infinity when output_price_per_token is +Infinity', () => {
      const infinitePricing: PricingEntry = {
        ...basePricing,
        output_price_per_token: Number.POSITIVE_INFINITY,
      };

      const result = computeTokenCost({
        inputTokens: 100,
        outputTokens: 50,
        model: 'gpt-4o',
        pricing: infinitePricing,
      });

      expect(result).toBe(Number.POSITIVE_INFINITY);
    });

    it('returns null when input_price_per_token is -Infinity with finite cache prices', () => {
      // With explicit finite cache prices, `0 * finite = 0`, so the cost
      // is `100 * (-Inf) + 0 + 0 + 50 * finite = -Inf`. `-Inf < 0` is true
      // → returns null (the existing negative-cost guard catches this).
      const negInfinite: PricingEntry = {
        ...basePricing,
        input_price_per_token: Number.NEGATIVE_INFINITY,
        cache_read_price_per_token: 0,
        cache_write_price_per_token: 0,
      };

      expect(
        computeTokenCost({
          inputTokens: 100,
          outputTokens: 50,
          model: 'gpt-4o',
          pricing: negInfinite,
        }),
      ).toBeNull();
    });

    it('returns NaN when input_price_per_token is -Infinity and cache prices fall back (0 * -Inf = NaN)', () => {
      // Without explicit cache prices, the `0 * (-Infinity)` terms produce
      // NaN which leaks past the negative-cost guard. Documented gap.
      const negInfinite: PricingEntry = {
        ...basePricing,
        input_price_per_token: Number.NEGATIVE_INFINITY,
      };

      const result = computeTokenCost({
        inputTokens: 100,
        outputTokens: 50,
        model: 'gpt-4o',
        pricing: negInfinite,
      });

      expect(Number.isNaN(result)).toBe(true);
    });

    it('returns NaN when one price is +Infinity and the other is -Infinity', () => {
      // +Infinity * input + (-Infinity) * output = NaN when both terms contribute
      const mixedInfinite: PricingEntry = {
        ...basePricing,
        input_price_per_token: Number.POSITIVE_INFINITY,
        output_price_per_token: Number.NEGATIVE_INFINITY,
      };

      const result = computeTokenCost({
        inputTokens: 100,
        outputTokens: 50,
        model: 'gpt-4o',
        pricing: mixedInfinite,
      });

      // +Inf + (-Inf) = NaN; NaN < 0 is false, so we get NaN back.
      expect(Number.isNaN(result)).toBe(true);
    });

    it('returns 0 for subscription even when pricing is +Infinity (short-circuit)', () => {
      const infinitePricing: PricingEntry = {
        ...basePricing,
        input_price_per_token: Number.POSITIVE_INFINITY,
        output_price_per_token: Number.POSITIVE_INFINITY,
      };

      expect(
        computeTokenCost({
          inputTokens: 100,
          outputTokens: 50,
          model: 'gpt-4o',
          pricing: infinitePricing,
          isSubscription: true,
        }),
      ).toBe(0);
    });

    it('returns the per-request cost for subscriptions even with Infinity pricing', () => {
      // Subscription branch never touches the token math, so Infinity is irrelevant.
      const infinitePricing: PricingEntry = {
        ...basePricing,
        input_price_per_token: Number.POSITIVE_INFINITY,
        output_price_per_token: Number.POSITIVE_INFINITY,
      };

      expect(
        computeTokenCost({
          inputTokens: 100,
          outputTokens: 50,
          model: 'gpt-4o',
          pricing: infinitePricing,
          isSubscription: true,
          perRequestCostUsd: 0.02,
        }),
      ).toBeCloseTo(0.02, 10);
    });
  });
});
