import type { ModelRoute } from 'manifest-shared';
import {
  collectRoutedModelIds,
  computeBaselineCost,
  pickMostExpensiveRoutedModel,
  type PricingLookup,
  type RoutingSlot,
} from './baseline-cost';
import type { UserProvider } from '../../entities/user-provider.entity';
import type { DiscoveredModel } from '../../model-discovery/model-fetcher';

const route = (provider: string, model: string): ModelRoute => ({
  provider,
  authType: 'api_key',
  model,
});

const mkModel = (overrides: Partial<DiscoveredModel>): DiscoveredModel =>
  ({
    id: overrides.id ?? 'm-1',
    displayName: overrides.id ?? 'm-1',
    provider: overrides.provider ?? 'openai',
    contextWindow: 0,
    inputPricePerToken: overrides.inputPricePerToken ?? 0.001,
    outputPricePerToken: overrides.outputPricePerToken ?? 0.002,
    capabilityReasoning: false,
    capabilityCode: false,
    qualityScore: 3,
    ...overrides,
  }) as DiscoveredModel;

describe('collectRoutedModelIds', () => {
  it('returns empty when slots are empty', () => {
    expect(collectRoutedModelIds([])).toEqual([]);
  });

  it('returns the override model when present', () => {
    const slot: RoutingSlot = {
      override_route: route('openai', 'gpt-4o'),
      auto_assigned_route: route('openai', 'gpt-3.5'),
      fallback_routes: null,
    };
    expect(collectRoutedModelIds([slot])).toEqual(['gpt-4o']);
  });

  it('returns the auto-assigned model when override is null', () => {
    const slot: RoutingSlot = {
      override_route: null,
      auto_assigned_route: route('openai', 'gpt-3.5'),
      fallback_routes: null,
    };
    expect(collectRoutedModelIds([slot])).toEqual(['gpt-3.5']);
  });

  it('includes fallback routes', () => {
    const slot: RoutingSlot = {
      override_route: null,
      auto_assigned_route: route('openai', 'gpt-4o'),
      fallback_routes: [route('anthropic', 'claude'), route('google', 'gemini')],
    };
    const ids = collectRoutedModelIds([slot]);
    expect(ids.sort()).toEqual(['claude', 'gemini', 'gpt-4o']);
  });

  it('deduplicates ids across slots', () => {
    const slot1: RoutingSlot = {
      override_route: route('openai', 'gpt-4o'),
      auto_assigned_route: null,
      fallback_routes: null,
    };
    const slot2: RoutingSlot = {
      override_route: null,
      auto_assigned_route: route('openai', 'gpt-4o'),
      fallback_routes: null,
    };
    expect(collectRoutedModelIds([slot1, slot2])).toEqual(['gpt-4o']);
  });

  it('skips empty model entries in fallback routes', () => {
    const slot: RoutingSlot = {
      override_route: null,
      auto_assigned_route: null,
      fallback_routes: [{ provider: 'p', authType: 'api_key', model: '' } as ModelRoute],
    };
    expect(collectRoutedModelIds([slot])).toEqual([]);
  });

  it('handles slots without auto_assigned_route field', () => {
    const slot: RoutingSlot = {
      override_route: route('openai', 'gpt-4o'),
      fallback_routes: null,
    };
    expect(collectRoutedModelIds([slot])).toEqual(['gpt-4o']);
  });
});

describe('pickMostExpensiveRoutedModel', () => {
  const provider = (cached: DiscoveredModel[]): UserProvider =>
    ({
      id: 'p1',
      provider: 'openai',
      is_active: true,
      cached_models: cached,
    }) as unknown as UserProvider;

  it('returns null when no routed model ids', () => {
    expect(pickMostExpensiveRoutedModel([], [])).toBeNull();
  });

  it('returns null when no providers expose the model', () => {
    expect(pickMostExpensiveRoutedModel([], ['gpt-4o'])).toBeNull();
  });

  it('picks the most expensive routed model from cached_models', () => {
    const p = provider([
      mkModel({ id: 'cheap', inputPricePerToken: 0.001, outputPricePerToken: 0.001 }),
      mkModel({ id: 'expensive', inputPricePerToken: 0.01, outputPricePerToken: 0.01 }),
    ]);
    const result = pickMostExpensiveRoutedModel([p], ['cheap', 'expensive']);
    expect(result?.id).toBe('expensive');
  });

  it('parses cached_models when stored as a JSON string', () => {
    const p = {
      id: 'p1',
      provider: 'openai',
      is_active: true,
      cached_models: JSON.stringify([
        mkModel({ id: 'gpt-4o', inputPricePerToken: 0.01, outputPricePerToken: 0.02 }),
      ]),
    } as unknown as UserProvider;
    const result = pickMostExpensiveRoutedModel([p], ['gpt-4o']);
    expect(result?.id).toBe('gpt-4o');
  });

  it('skips providers with malformed cached_models JSON', () => {
    const p = {
      id: 'p1',
      provider: 'openai',
      is_active: true,
      cached_models: 'not-json',
    } as unknown as UserProvider;
    expect(pickMostExpensiveRoutedModel([p], ['gpt-4o'])).toBeNull();
  });

  it('skips providers when cached_models is not an array', () => {
    const p = {
      id: 'p1',
      provider: 'openai',
      is_active: true,
      cached_models: { not: 'an-array' },
    } as unknown as UserProvider;
    expect(pickMostExpensiveRoutedModel([p], ['gpt-4o'])).toBeNull();
  });

  it('skips inactive providers', () => {
    const p = {
      id: 'p1',
      provider: 'openai',
      is_active: false,
      cached_models: [mkModel({ id: 'gpt-4o' })],
    } as unknown as UserProvider;
    expect(pickMostExpensiveRoutedModel([p], ['gpt-4o'])).toBeNull();
  });

  it('skips providers without cached_models', () => {
    const p = {
      id: 'p1',
      provider: 'openai',
      is_active: true,
      cached_models: null,
    } as unknown as UserProvider;
    expect(pickMostExpensiveRoutedModel([p], ['gpt-4o'])).toBeNull();
  });

  it('keeps only the first occurrence of a duplicate model id', () => {
    const p1 = provider([
      mkModel({ id: 'gpt-4o', inputPricePerToken: 0.01, outputPricePerToken: 0.01 }),
    ]);
    const p2 = provider([
      mkModel({ id: 'gpt-4o', inputPricePerToken: 0.99, outputPricePerToken: 0.99 }),
    ]);
    const result = pickMostExpensiveRoutedModel([p1, p2], ['gpt-4o']);
    // First occurrence wins regardless of price.
    expect(result?.inputPricePerToken).toBe(0.01);
  });

  it('enriches with pricing lookup when cached prices are missing', () => {
    const p = provider([
      mkModel({ id: 'gpt-4o', inputPricePerToken: null, outputPricePerToken: null }),
    ]);
    const lookup: PricingLookup = {
      getByModel: jest.fn().mockReturnValue({
        input_price_per_token: 0.01,
        output_price_per_token: 0.02,
        provider: 'OpenAI',
        model_name: 'gpt-4o',
        display_name: null,
      }),
    };
    const result = pickMostExpensiveRoutedModel([p], ['gpt-4o'], lookup);
    expect(result?.inputPricePerToken).toBe(0.01);
    expect(result?.outputPricePerToken).toBe(0.02);
  });

  it('skips models with non-positive prices after enrichment fails', () => {
    const p = provider([mkModel({ id: 'gpt-4o', inputPricePerToken: 0, outputPricePerToken: 0 })]);
    const lookup: PricingLookup = {
      getByModel: jest.fn().mockReturnValue({
        input_price_per_token: 0,
        output_price_per_token: 0,
        provider: 'OpenAI',
        model_name: 'gpt-4o',
        display_name: null,
      }),
    };
    expect(pickMostExpensiveRoutedModel([p], ['gpt-4o'], lookup)).toBeNull();
  });

  it('falls back to pricing lookup when no providers list the routed models', () => {
    const lookup: PricingLookup = {
      getByModel: jest.fn().mockImplementation((id: string) =>
        id === 'gpt-4o'
          ? {
              input_price_per_token: 0.01,
              output_price_per_token: 0.02,
              provider: 'OpenAI',
              model_name: 'gpt-4o',
              display_name: 'GPT-4o',
            }
          : undefined,
      ),
    };
    const result = pickMostExpensiveRoutedModel([], ['gpt-4o', 'unknown'], lookup);
    expect(result?.id).toBe('gpt-4o');
    expect(result?.displayName).toBe('GPT-4o');
  });

  it('picks the most expensive entry from pricing lookup fallback', () => {
    const lookup: PricingLookup = {
      getByModel: jest.fn().mockImplementation((id: string) => {
        if (id === 'cheap')
          return {
            input_price_per_token: 0.001,
            output_price_per_token: 0.001,
            provider: 'OpenAI',
            model_name: 'cheap',
            display_name: null,
          };
        if (id === 'expensive')
          return {
            input_price_per_token: 0.05,
            output_price_per_token: 0.05,
            provider: 'OpenAI',
            model_name: 'expensive',
            display_name: null,
          };
        return undefined;
      }),
    };
    const result = pickMostExpensiveRoutedModel([], ['cheap', 'expensive'], lookup);
    expect(result?.id).toBe('expensive');
  });

  it('returns null when pricing lookup yields no usable entries', () => {
    const lookup: PricingLookup = {
      getByModel: jest.fn().mockReturnValue(undefined),
    };
    expect(pickMostExpensiveRoutedModel([], ['gpt-4o'], lookup)).toBeNull();
  });

  it('uses display_name fallback to id when pricing entry has none', () => {
    const lookup: PricingLookup = {
      getByModel: jest.fn().mockReturnValue({
        input_price_per_token: 0.01,
        output_price_per_token: 0.02,
        provider: undefined,
        model_name: 'gpt-4o',
        display_name: null,
      }),
    };
    const result = pickMostExpensiveRoutedModel([], ['gpt-4o'], lookup);
    expect(result?.displayName).toBe('gpt-4o');
    expect(result?.provider).toBe('unknown');
  });
});

describe('computeBaselineCost', () => {
  const provider = (cached: DiscoveredModel[]): UserProvider =>
    ({
      id: 'p1',
      provider: 'openai',
      is_active: true,
      cached_models: cached,
    }) as unknown as UserProvider;

  it('returns null when no model can be picked', () => {
    expect(computeBaselineCost([], [], 100, 100)).toBeNull();
  });

  it('returns the cost for the most expensive routed model', () => {
    const p = provider([
      mkModel({ id: 'gpt-4o', inputPricePerToken: 0.01, outputPricePerToken: 0.02 }),
    ]);
    const result = computeBaselineCost([p], ['gpt-4o'], 1_000, 500);
    expect(result?.modelId).toBe('gpt-4o');
    expect(result?.cost).toBe(1_000 * 0.01 + 500 * 0.02);
  });

  it('clamps negative cost to zero', () => {
    const p = provider([
      mkModel({ id: 'weird', inputPricePerToken: 0.01, outputPricePerToken: 0.02 }),
    ]);
    const result = computeBaselineCost([p], ['weird'], -1, -1);
    expect(result?.cost).toBe(0);
  });
});
