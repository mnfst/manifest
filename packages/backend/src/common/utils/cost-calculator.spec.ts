import { computeTokenCost, CostInput } from './cost-calculator';
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
});
