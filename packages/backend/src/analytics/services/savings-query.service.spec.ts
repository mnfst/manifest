import { selectBaselineModel } from './savings-query.service';
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

describe('selectBaselineModel', () => {
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
    const result = selectBaselineModel(providers, []);
    expect(result?.id).toBe('cheap-reasoning');
  });

  it('falls back to highest qualityScore when no reasoning model exists', () => {
    const providers = [
      provider([
        model({ id: 'low-quality', qualityScore: 2 }),
        model({ id: 'high-quality', qualityScore: 5 }),
      ]),
    ];
    const result = selectBaselineModel(providers, []);
    expect(result?.id).toBe('high-quality');
  });

  it('returns null when no paid models exist', () => {
    const providers = [provider([model({ inputPricePerToken: 0, outputPricePerToken: 0 })])];
    const result = selectBaselineModel(providers, []);
    expect(result).toBeNull();
  });

  it('returns null for empty provider list', () => {
    const result = selectBaselineModel([], []);
    expect(result).toBeNull();
  });

  it('returns null when all providers have null cached_models', () => {
    const providers = [provider([], { cached_models: null as never })];
    const result = selectBaselineModel(providers, []);
    expect(result).toBeNull();
  });

  it('skips inactive providers', () => {
    const providers = [
      provider([model({ id: 'inactive-model', capabilityReasoning: true })], { is_active: false }),
    ];
    const result = selectBaselineModel(providers, []);
    expect(result).toBeNull();
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
        model({
          id: 'valid',
          inputPricePerToken: 0.000003,
          outputPricePerToken: 0.000015,
          capabilityReasoning: true,
        }),
      ]),
    ];
    const result = selectBaselineModel(providers, []);
    expect(result?.id).toBe('valid');
  });

  it('handles malformed cached_models JSON gracefully', () => {
    const providers = [
      provider([], { cached_models: 'not valid json{' as never }),
      provider([model({ id: 'valid', capabilityReasoning: true })]),
    ];
    const result = selectBaselineModel(providers, []);
    expect(result?.id).toBe('valid');
  });

  it('handles cached_models stored as JSON string', () => {
    const models = [model({ id: 'from-string', capabilityReasoning: true })];
    const providers = [provider([], { cached_models: JSON.stringify(models) as never })];
    const result = selectBaselineModel(providers, []);
    expect(result?.id).toBe('from-string');
  });

  it('merges models across multiple providers', () => {
    const providers = [
      provider([
        model({
          id: 'expensive',
          inputPricePerToken: 0.00001,
          outputPricePerToken: 0.00003,
          capabilityReasoning: true,
        }),
      ]),
      provider([
        model({
          id: 'cheapest',
          inputPricePerToken: 0.000001,
          outputPricePerToken: 0.000004,
          capabilityReasoning: true,
        }),
      ]),
    ];
    const result = selectBaselineModel(providers, []);
    expect(result?.id).toBe('cheapest');
  });

  it('treats missing capabilityReasoning as false', () => {
    const m = model({ id: 'no-flag', qualityScore: 5 });
    delete (m as unknown as Record<string, unknown>).capabilityReasoning;
    const providers = [provider([m])];
    const result = selectBaselineModel(providers, []);
    expect(result?.id).toBe('no-flag');
    // Falls back to quality-based since no reasoning models
  });

  it('includes historical models in candidate pool', () => {
    const providers = [
      provider([
        model({
          id: 'current-expensive',
          inputPricePerToken: 0.00005,
          outputPricePerToken: 0.00015,
          capabilityReasoning: true,
        }),
      ]),
    ];
    const historical = [
      {
        id: 'old-cheap',
        display_name: 'Old Cheap',
        provider: 'old',
        input_price_per_token: 0.000001,
        output_price_per_token: 0.000004,
      },
    ];
    const result = selectBaselineModel(providers, historical);
    // old-cheap is cheaper but has no reasoning capability (historical models default to false)
    // so current-expensive wins because it has reasoning
    expect(result?.id).toBe('current-expensive');
  });

  it('picks historical model when no current providers', () => {
    const historical = [
      {
        id: 'hist-a',
        display_name: 'Hist A',
        provider: 'p1',
        input_price_per_token: 0.00001,
        output_price_per_token: 0.00005,
      },
      {
        id: 'hist-b',
        display_name: 'Hist B',
        provider: 'p2',
        input_price_per_token: 0.000001,
        output_price_per_token: 0.000004,
      },
    ];
    const result = selectBaselineModel([], historical);
    // No reasoning models, falls back to quality. Both have qualityScore 0, so first wins
    expect(result).not.toBeNull();
  });

  it('deduplicates models between providers and history', () => {
    const providers = [
      provider([
        model({
          id: 'shared-model',
          inputPricePerToken: 0.000003,
          outputPricePerToken: 0.000015,
          capabilityReasoning: true,
        }),
      ]),
    ];
    const historical = [
      {
        id: 'shared-model',
        display_name: 'Shared',
        provider: 'p1',
        input_price_per_token: 0.000003,
        output_price_per_token: 0.000015,
      },
    ];
    const result = selectBaselineModel(providers, historical);
    expect(result?.id).toBe('shared-model');
  });
});
