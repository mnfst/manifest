import { computeTokenCost } from './cost-calculator';
import { PricingEntry } from '../../model-prices/model-pricing-cache.service';

describe('computeTokenCost', () => {
  const pricing: PricingEntry = {
    model_name: 'gpt-4o',
    provider: 'OpenAI',
    input_price_per_token: 0.0000025,
    output_price_per_token: 0.00001,
    display_name: 'GPT-4o',
  };

  it('returns null when model is null', () => {
    expect(
      computeTokenCost({ inputTokens: 100, outputTokens: 50, model: null, pricing }),
    ).toBeNull();
  });

  it('returns null when model is undefined', () => {
    expect(
      computeTokenCost({ inputTokens: 100, outputTokens: 50, model: undefined, pricing }),
    ).toBeNull();
  });

  it('returns null when both token counts are zero', () => {
    expect(
      computeTokenCost({ inputTokens: 0, outputTokens: 0, model: 'gpt-4o', pricing }),
    ).toBeNull();
  });

  it('returns 0 when isSubscription is true', () => {
    expect(
      computeTokenCost({
        inputTokens: 1000,
        outputTokens: 500,
        model: 'gpt-4o',
        pricing,
        isSubscription: true,
      }),
    ).toBe(0);
  });

  it('returns null when pricing is undefined', () => {
    expect(
      computeTokenCost({
        inputTokens: 100,
        outputTokens: 50,
        model: 'unknown-model',
        pricing: undefined,
      }),
    ).toBeNull();
  });

  it('returns null when input_price_per_token is null', () => {
    const partial: PricingEntry = { ...pricing, input_price_per_token: null };
    expect(
      computeTokenCost({ inputTokens: 100, outputTokens: 50, model: 'gpt-4o', pricing: partial }),
    ).toBeNull();
  });

  it('returns null when output_price_per_token is null', () => {
    const partial: PricingEntry = { ...pricing, output_price_per_token: null };
    expect(
      computeTokenCost({ inputTokens: 100, outputTokens: 50, model: 'gpt-4o', pricing: partial }),
    ).toBeNull();
  });

  it('computes cost correctly with both token types', () => {
    const result = computeTokenCost({
      inputTokens: 1000,
      outputTokens: 500,
      model: 'gpt-4o',
      pricing,
    });
    // 1000 * 0.0000025 + 500 * 0.00001 = 0.0025 + 0.005 = 0.0075
    expect(result).toBeCloseTo(0.0075, 10);
  });

  it('computes cost with only input tokens', () => {
    const result = computeTokenCost({
      inputTokens: 2000,
      outputTokens: 0,
      model: 'gpt-4o',
      pricing,
    });
    // inputTokens > 0 && outputTokens === 0 → not both zero, so compute
    // 2000 * 0.0000025 + 0 * 0.00001 = 0.005
    expect(result).toBeCloseTo(0.005, 10);
  });

  it('computes cost with only output tokens', () => {
    const result = computeTokenCost({
      inputTokens: 0,
      outputTokens: 300,
      model: 'gpt-4o',
      pricing,
    });
    // 0 * 0.0000025 + 300 * 0.00001 = 0.003
    expect(result).toBeCloseTo(0.003, 10);
  });

  it('handles string-typed price fields via Number() coercion', () => {
    const stringPricing: PricingEntry = {
      model_name: 'test-model',
      provider: 'Test',
      input_price_per_token: '0.000005' as unknown as number,
      output_price_per_token: '0.00002' as unknown as number,
      display_name: null,
    };
    const result = computeTokenCost({
      inputTokens: 100,
      outputTokens: 200,
      model: 'test-model',
      pricing: stringPricing,
    });
    // 100 * 0.000005 + 200 * 0.00002 = 0.0005 + 0.004 = 0.0045
    expect(result).toBeCloseTo(0.0045, 10);
  });

  it('returns 0 for subscription even when pricing has null prices', () => {
    const noPricing: PricingEntry = {
      ...pricing,
      input_price_per_token: null,
      output_price_per_token: null,
    };
    expect(
      computeTokenCost({
        inputTokens: 500,
        outputTokens: 200,
        model: 'gpt-4o',
        pricing: noPricing,
        isSubscription: true,
      }),
    ).toBe(0);
  });

  it('returns null when computed cost would be negative (both prices negative)', () => {
    const negativePricing: PricingEntry = {
      model_name: 'bad-model',
      provider: 'Test',
      input_price_per_token: -1,
      output_price_per_token: -1,
      display_name: null,
    };
    expect(
      computeTokenCost({
        inputTokens: 100,
        outputTokens: 50,
        model: 'bad-model',
        pricing: negativePricing,
      }),
    ).toBeNull();
  });

  it('returns null when net cost is negative from mixed positive/negative prices', () => {
    const mixedPricing: PricingEntry = {
      model_name: 'mixed-model',
      provider: 'Test',
      input_price_per_token: -0.01,
      output_price_per_token: 0.000001,
      display_name: null,
    };
    // -0.01 * 1000 + 0.000001 * 10 = -10 + 0.00001 = -9.99999 < 0
    expect(
      computeTokenCost({
        inputTokens: 1000,
        outputTokens: 10,
        model: 'mixed-model',
        pricing: mixedPricing,
      }),
    ).toBeNull();
  });

  it('returns the computed value when cost is exactly zero (free model)', () => {
    const freePricing: PricingEntry = {
      model_name: 'free-model',
      provider: 'Free',
      input_price_per_token: 0,
      output_price_per_token: 0,
      display_name: null,
    };
    // 0 * 500 + 0 * 200 = 0, which is >= 0 so it should return 0
    expect(
      computeTokenCost({
        inputTokens: 500,
        outputTokens: 200,
        model: 'free-model',
        pricing: freePricing,
      }),
    ).toBe(0);
  });

  it('returns null for empty-string model (falsy)', () => {
    expect(
      computeTokenCost({
        inputTokens: 100,
        outputTokens: 50,
        model: '' as unknown as string,
        pricing,
      }),
    ).toBeNull();
  });

  it('returns 0 for subscription even when tokens are zero', () => {
    expect(
      computeTokenCost({
        inputTokens: 0,
        outputTokens: 0,
        model: 'gpt-4o',
        pricing: undefined,
        isSubscription: true,
      }),
    ).toBe(0);
  });

  it('subscription check takes priority over negative pricing guard', () => {
    const negativePricing: PricingEntry = {
      model_name: 'bad-model',
      provider: 'Test',
      input_price_per_token: -1,
      output_price_per_token: -1,
      display_name: null,
    };
    expect(
      computeTokenCost({
        inputTokens: 100,
        outputTokens: 50,
        model: 'bad-model',
        pricing: negativePricing,
        isSubscription: true,
      }),
    ).toBe(0);
  });
});
