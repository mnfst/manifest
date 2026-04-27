import {
  computeBaselineCost,
  pickMostExpensiveRoutedModel,
  collectRoutedModelIds,
  type PricingLookup,
  type RoutingSlot,
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

describe('collectRoutedModelIds', () => {
  it('collects override_model, auto_assigned_model, and fallback_models', () => {
    const slots: RoutingSlot[] = [
      { override_model: 'gpt-4o', auto_assigned_model: 'gpt-3.5', fallback_models: ['claude-3'] },
      { override_model: null, auto_assigned_model: 'gemini-pro', fallback_models: null },
    ];
    const ids = collectRoutedModelIds(slots);
    expect(ids).toContain('gpt-4o');
    expect(ids).toContain('claude-3');
    expect(ids).toContain('gemini-pro');
    // override takes priority, auto_assigned is not added when override exists
    // but both are collected since they're different models in the routing
    expect(ids.length).toBe(3);
  });

  it('prefers override_model over auto_assigned_model', () => {
    const slots: RoutingSlot[] = [
      { override_model: 'override', auto_assigned_model: 'auto', fallback_models: null },
    ];
    const ids = collectRoutedModelIds(slots);
    expect(ids).toContain('override');
    expect(ids).not.toContain('auto');
  });

  it('uses auto_assigned_model when override_model is null', () => {
    const slots: RoutingSlot[] = [
      { override_model: null, auto_assigned_model: 'auto', fallback_models: null },
    ];
    const ids = collectRoutedModelIds(slots);
    expect(ids).toContain('auto');
  });

  it('returns empty array for empty slots', () => {
    expect(collectRoutedModelIds([])).toEqual([]);
  });

  it('deduplicates model IDs', () => {
    const slots: RoutingSlot[] = [
      { override_model: 'gpt-4o', fallback_models: ['gpt-4o'] },
      { override_model: 'gpt-4o', fallback_models: null },
    ];
    const ids = collectRoutedModelIds(slots);
    expect(ids).toEqual(['gpt-4o']);
  });

  it('skips null/empty fallback entries', () => {
    const slots: RoutingSlot[] = [
      { override_model: 'gpt-4o', fallback_models: [null as unknown as string, '', 'claude-3'] },
    ];
    const ids = collectRoutedModelIds(slots);
    expect(ids).toContain('gpt-4o');
    expect(ids).toContain('claude-3');
    expect(ids).not.toContain('');
  });
});

describe('pickMostExpensiveRoutedModel', () => {
  it('picks the most expensive model among routed IDs', () => {
    const providers = [
      provider([
        model({
          id: 'cheap',
          inputPricePerToken: 0.000001,
          outputPricePerToken: 0.000002,
        }),
        model({
          id: 'expensive',
          inputPricePerToken: 0.00001,
          outputPricePerToken: 0.00003,
        }),
      ]),
    ];
    const result = pickMostExpensiveRoutedModel(providers, ['cheap', 'expensive']);
    expect(result?.id).toBe('expensive');
  });

  it('only considers models in routedModelIds', () => {
    const providers = [
      provider([
        model({
          id: 'not-routed',
          inputPricePerToken: 0.001,
          outputPricePerToken: 0.001,
        }),
        model({
          id: 'routed',
          inputPricePerToken: 0.000001,
          outputPricePerToken: 0.000002,
        }),
      ]),
    ];
    const result = pickMostExpensiveRoutedModel(providers, ['routed']);
    expect(result?.id).toBe('routed');
  });

  it('returns null when routedModelIds is empty', () => {
    const providers = [provider([model()])];
    expect(pickMostExpensiveRoutedModel(providers, [])).toBeNull();
  });

  it('returns null when no routed models found in providers', () => {
    const providers = [provider([model({ id: 'other' })])];
    expect(pickMostExpensiveRoutedModel(providers, ['not-here'])).toBeNull();
  });

  it('skips inactive providers', () => {
    const providers = [provider([model({ id: 'inactive-model' })], { is_active: false })];
    expect(pickMostExpensiveRoutedModel(providers, ['inactive-model'])).toBeNull();
  });

  it('skips null cached_models', () => {
    const providers = [provider([], { cached_models: null as never })];
    expect(pickMostExpensiveRoutedModel(providers, ['any'])).toBeNull();
  });

  it('handles JSON string cached_models', () => {
    const models = [model({ id: 'from-json' })];
    const providers = [provider([], { cached_models: JSON.stringify(models) as never })];
    const result = pickMostExpensiveRoutedModel(providers, ['from-json']);
    expect(result?.id).toBe('from-json');
  });

  it('handles malformed JSON gracefully', () => {
    const providers = [
      provider([], { cached_models: 'not json{' as never }),
      provider([model({ id: 'valid' })]),
    ];
    const result = pickMostExpensiveRoutedModel(providers, ['valid']);
    expect(result?.id).toBe('valid');
  });

  it('enriches subscription models with real API pricing from lookup', () => {
    const providers = [
      provider([
        model({
          id: 'sub-model',
          inputPricePerToken: 0,
          outputPricePerToken: 0,
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
    const result = pickMostExpensiveRoutedModel(providers, ['sub-model'], lookup);
    expect(result?.id).toBe('sub-model');
    expect(result?.inputPricePerToken).toBe(0.000001);
  });

  it('picks subscription model when its API-equivalent price is highest', () => {
    const providers = [
      provider([
        model({
          id: 'api-model',
          inputPricePerToken: 0.000005,
          outputPricePerToken: 0.00001,
        }),
        model({
          id: 'sub-model',
          inputPricePerToken: 0,
          outputPricePerToken: 0,
        }),
      ]),
    ];
    const lookup: PricingLookup = {
      getByModel: (id: string) =>
        id === 'sub-model'
          ? {
              input_price_per_token: 0.00001,
              output_price_per_token: 0.00005,
              provider: 'Anthropic',
              model_name: 'sub-model',
              display_name: 'Claude Opus',
            }
          : undefined,
    };
    const result = pickMostExpensiveRoutedModel(providers, ['api-model', 'sub-model'], lookup);
    expect(result?.id).toBe('sub-model');
  });

  it('deduplicates models across providers', () => {
    const providers = [provider([model({ id: 'same' })]), provider([model({ id: 'same' })])];
    const result = pickMostExpensiveRoutedModel(providers, ['same']);
    expect(result?.id).toBe('same');
  });

  it('skips models with null pricing that cannot be enriched', () => {
    const providers = [
      provider([
        model({
          id: 'null-price',
          inputPricePerToken: null as never,
          outputPricePerToken: null as never,
        }),
        model({ id: 'valid' }),
      ]),
    ];
    const result = pickMostExpensiveRoutedModel(providers, ['null-price', 'valid']);
    expect(result?.id).toBe('valid');
  });

  it('falls back to pricing lookup when model not in providers', () => {
    const providers = [provider([model({ id: 'other' })])];
    const lookup: PricingLookup = {
      getByModel: (id: string) =>
        id === 'orphaned'
          ? {
              input_price_per_token: 0.00002,
              output_price_per_token: 0.00006,
              provider: 'OpenAI',
              model_name: 'orphaned',
              display_name: 'GPT-5',
            }
          : undefined,
    };
    const result = pickMostExpensiveRoutedModel(providers, ['orphaned'], lookup);
    expect(result?.id).toBe('orphaned');
    expect(result?.inputPricePerToken).toBe(0.00002);
  });
});

describe('computeBaselineCost', () => {
  it('computes cost using most expensive routed model', () => {
    const providers = [
      provider([
        model({
          id: 'cheap-model',
          inputPricePerToken: 0.000001,
          outputPricePerToken: 0.000002,
        }),
        model({
          id: 'expensive-model',
          inputPricePerToken: 0.00001,
          outputPricePerToken: 0.00005,
        }),
      ]),
    ];
    const result = computeBaselineCost(providers, ['cheap-model', 'expensive-model'], 1000, 500);
    expect(result).not.toBeNull();
    expect(result!.modelId).toBe('expensive-model');
    // 1000 * 0.00001 + 500 * 0.00005 = 0.01 + 0.025 = 0.035
    expect(result!.cost).toBeCloseTo(0.035, 6);
  });

  it('returns null when no routed models', () => {
    expect(computeBaselineCost([], [], 1000, 500)).toBeNull();
  });

  it('clamps negative cost to 0', () => {
    const providers = [
      provider([
        model({
          id: 'm',
          inputPricePerToken: 0.000001,
          outputPricePerToken: 0.000001,
        }),
      ]),
    ];
    const result = computeBaselineCost(providers, ['m'], 0, 0);
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
    const result = computeBaselineCost(providers, ['sub-only'], 10000, 500, lookup);
    expect(result).not.toBeNull();
    expect(result!.modelId).toBe('sub-only');
    expect(result!.cost).toBeCloseTo(0.02 + 0.004, 6);
  });
});
