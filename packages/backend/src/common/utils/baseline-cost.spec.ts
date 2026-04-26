import {
  computeBaselineCost,
  pickCheapestReasoningModel,
  type PricingLookup,
} from './baseline-cost';
import type { UserProvider } from '../../entities/user-provider.entity';
import type { DiscoveredModel } from '../../model-discovery/model-fetcher';

function model(overrides: Partial<DiscoveredModel> = {}): DiscoveredModel {
  return {
    id: 'model-1',
    displayName: 'Model One',
    provider: 'test-provider',
    contextWindow: 128000,
    inputPricePerToken: 0.000003,
    outputPricePerToken: 0.000015,
    capabilityReasoning: false,
    capabilityCode: true,
    qualityScore: 3,
    ...overrides,
  };
}

function provider(models: DiscoveredModel[], overrides: Partial<UserProvider> = {}): UserProvider {
  return {
    cached_models: models,
    is_active: true,
    ...overrides,
  } as unknown as UserProvider;
}

describe('pickCheapestReasoningModel', () => {
  it('picks cheapest reasoning-capable model', () => {
    const providers = [
      provider([
        model({
          id: 'expensive',
          inputPricePerToken: 0.00001,
          outputPricePerToken: 0.00003,
          capabilityReasoning: true,
        }),
        model({
          id: 'cheap-reasoning',
          inputPricePerToken: 0.000002,
          outputPricePerToken: 0.000008,
          capabilityReasoning: true,
        }),
      ]),
    ];
    expect(pickCheapestReasoningModel(providers)?.id).toBe('cheap-reasoning');
  });

  it('falls back to highest qualityScore when no reasoning model', () => {
    const providers = [
      provider([model({ id: 'low-q', qualityScore: 2 }), model({ id: 'high-q', qualityScore: 5 })]),
    ];
    expect(pickCheapestReasoningModel(providers)?.id).toBe('high-q');
  });

  it('returns null when no paid models', () => {
    const providers = [provider([model({ inputPricePerToken: 0, outputPricePerToken: 0 })])];
    expect(pickCheapestReasoningModel(providers)).toBeNull();
  });

  it('returns null for empty providers', () => {
    expect(pickCheapestReasoningModel([])).toBeNull();
  });

  it('skips inactive providers', () => {
    const providers = [
      provider([model({ id: 'inactive', capabilityReasoning: true })], { is_active: false }),
    ];
    expect(pickCheapestReasoningModel(providers)).toBeNull();
  });

  it('skips null cached_models', () => {
    const providers = [provider([], { cached_models: null as never })];
    expect(pickCheapestReasoningModel(providers)).toBeNull();
  });

  it('handles JSON string cached_models', () => {
    const models = [model({ id: 'from-json', capabilityReasoning: true })];
    const providers = [provider([], { cached_models: JSON.stringify(models) as never })];
    expect(pickCheapestReasoningModel(providers)?.id).toBe('from-json');
  });

  it('handles malformed JSON gracefully', () => {
    const providers = [
      provider([], { cached_models: 'not json{' as never }),
      provider([model({ id: 'valid', capabilityReasoning: true })]),
    ];
    expect(pickCheapestReasoningModel(providers)?.id).toBe('valid');
  });

  it('skips models with null pricing', () => {
    const providers = [
      provider([
        model({
          id: 'null-price',
          inputPricePerToken: null as never,
          outputPricePerToken: null as never,
          capabilityReasoning: true,
        }),
        model({ id: 'valid', capabilityReasoning: true }),
      ]),
    ];
    expect(pickCheapestReasoningModel(providers)?.id).toBe('valid');
  });

  it('enriches subscription models with real API pricing from lookup', () => {
    const providers = [
      provider([
        model({
          id: 'sub-model',
          inputPricePerToken: 0,
          outputPricePerToken: 0,
          capabilityReasoning: false,
        }),
      ]),
    ];
    const lookup: PricingLookup = {
      getByModel: (id: string) =>
        id === 'sub-model'
          ? {
              input_price_per_token: 0.000001,
              output_price_per_token: 0.000004,
              provider: 'test',
              model_name: 'sub-model',
              display_name: 'Sub Model',
            }
          : undefined,
    };
    const result = pickCheapestReasoningModel(providers, lookup);
    expect(result?.id).toBe('sub-model');
    expect(result?.inputPricePerToken).toBe(0.000001);
  });

  it('prefers cheaper subscription model over expensive api_key model', () => {
    const providers = [
      provider([
        model({
          id: 'expensive-api',
          inputPricePerToken: 0.00001,
          outputPricePerToken: 0.00005,
          capabilityReasoning: true,
        }),
        model({
          id: 'cheap-sub',
          inputPricePerToken: 0,
          outputPricePerToken: 0,
          capabilityReasoning: false,
        }),
      ]),
    ];
    const lookup: PricingLookup = {
      getByModel: (id: string) =>
        id === 'cheap-sub'
          ? {
              input_price_per_token: 0.000001,
              output_price_per_token: 0.000002,
              provider: 'test',
              model_name: 'cheap-sub',
              display_name: 'Cheap Sub',
            }
          : undefined,
    };
    // cheap-sub has no reasoning capability, so expensive-api wins
    const result = pickCheapestReasoningModel(providers, lookup);
    expect(result?.id).toBe('expensive-api');
  });

  it('deduplicates models across providers', () => {
    const providers = [
      provider([model({ id: 'same', capabilityReasoning: true })]),
      provider([model({ id: 'same', capabilityReasoning: true })]),
    ];
    const result = pickCheapestReasoningModel(providers);
    expect(result?.id).toBe('same');
  });
});

describe('computeBaselineCost', () => {
  it('computes cost using cheapest reasoning model', () => {
    const providers = [
      provider([
        model({
          id: 'baseline-model',
          inputPricePerToken: 0.000001,
          outputPricePerToken: 0.000005,
          capabilityReasoning: true,
        }),
      ]),
    ];
    const result = computeBaselineCost(providers, 1000, 500);
    expect(result).not.toBeNull();
    expect(result!.modelId).toBe('baseline-model');
    expect(result!.cost).toBeCloseTo(0.001 + 0.0025, 6);
  });

  it('returns null when no model available', () => {
    expect(computeBaselineCost([], 1000, 500)).toBeNull();
  });

  it('clamps negative cost to 0', () => {
    const providers = [
      provider([
        model({
          id: 'm',
          inputPricePerToken: 0.000001,
          outputPricePerToken: 0.000001,
          capabilityReasoning: true,
        }),
      ]),
    ];
    const result = computeBaselineCost(providers, 0, 0);
    expect(result!.cost).toBe(0);
  });

  it('passes pricing lookup to enrich subscription models', () => {
    const providers = [
      provider([
        model({
          id: 'sub-only',
          inputPricePerToken: 0,
          outputPricePerToken: 0,
        }),
      ]),
    ];
    const lookup: PricingLookup = {
      getByModel: () => ({
        input_price_per_token: 0.000002,
        output_price_per_token: 0.000008,
        provider: 'test',
        model_name: 'sub-only',
        display_name: 'Sub Only',
      }),
    };
    const result = computeBaselineCost(providers, 10000, 500, lookup);
    expect(result).not.toBeNull();
    expect(result!.modelId).toBe('sub-only');
    expect(result!.cost).toBeCloseTo(0.02 + 0.004, 6);
  });
});
