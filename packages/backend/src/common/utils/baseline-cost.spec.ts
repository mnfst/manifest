import { computeBaselineCost, pickCheapestReasoningModel } from './baseline-cost';
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
});
