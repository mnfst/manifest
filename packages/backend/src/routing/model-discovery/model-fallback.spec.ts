import {
  buildFallbackModels,
  buildSubscriptionFallbackModels,
  supplementWithKnownModels,
  findOpenRouterPrefix,
  lookupWithVariants,
} from './model-fallback';

function makePricingSync(
  entries: Map<
    string,
    { input: number; output: number; contextWindow?: number; displayName?: string }
  >,
) {
  return {
    lookupPricing: jest.fn((key: string) => entries.get(key) ?? null),
    getAll: jest.fn(() => entries),
  };
}

describe('buildFallbackModels', () => {
  it('should return models from OpenRouter cache for the given provider', () => {
    const cache = new Map([
      ['openai/gpt-4o', { input: 0.01, output: 0.02, displayName: 'GPT-4o' }],
      ['openai/gpt-4-turbo', { input: 0.005, output: 0.01 }],
      ['anthropic/claude-opus-4-6', { input: 0.015, output: 0.075 }],
    ]);

    const result = buildFallbackModels(makePricingSync(cache), 'openai');

    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toEqual(['gpt-4o', 'gpt-4-turbo']);
  });

  it('should return empty when pricingSync is null', () => {
    expect(buildFallbackModels(null, 'openai')).toEqual([]);
  });

  it('should return empty when no prefix found', () => {
    const cache = new Map([['openai/gpt-4o', { input: 0.01, output: 0.02 }]]);

    expect(buildFallbackModels(makePricingSync(cache), 'unknown-provider')).toEqual([]);
  });

  describe('with confirmedModels', () => {
    it('should filter out models not in the confirmed set', () => {
      const cache = new Map([
        ['qwen/qwen3-32b', { input: 0.01, output: 0.02, displayName: 'Qwen3 32B' }],
        ['qwen/qwen3.5-9b', { input: 0.005, output: 0.01, displayName: 'Qwen3.5 9B' }],
        ['qwen/qwen2.5-72b-instruct', { input: 0.02, output: 0.04 }],
      ]);
      const confirmed = new Set(['qwen3-32b', 'qwen2.5-72b-instruct']);

      const result = buildFallbackModels(makePricingSync(cache), 'qwen', confirmed);

      expect(result).toHaveLength(2);
      expect(result.map((m) => m.id)).toEqual(['qwen3-32b', 'qwen2.5-72b-instruct']);
    });

    it('should return all models when confirmedModels is null', () => {
      const cache = new Map([
        ['qwen/qwen3-32b', { input: 0.01, output: 0.02 }],
        ['qwen/phantom-model', { input: 0.005, output: 0.01 }],
      ]);

      const result = buildFallbackModels(makePricingSync(cache), 'qwen', null);

      expect(result).toHaveLength(2);
    });

    it('should return all models when confirmedModels is empty', () => {
      const cache = new Map([
        ['qwen/qwen3-32b', { input: 0.01, output: 0.02 }],
        ['qwen/phantom-model', { input: 0.005, output: 0.01 }],
      ]);
      const confirmed = new Set<string>();

      const result = buildFallbackModels(makePricingSync(cache), 'qwen', confirmed);

      expect(result).toHaveLength(2);
    });

    it('should match confirmed models case-insensitively', () => {
      const cache = new Map([['openai/GPT-4o', { input: 0.01, output: 0.02 }]]);
      const confirmed = new Set(['gpt-4o']);

      const result = buildFallbackModels(makePricingSync(cache), 'openai', confirmed);

      expect(result).toHaveLength(1);
    });

    it('should return empty when no models match confirmed set', () => {
      const cache = new Map([
        ['qwen/phantom-1', { input: 0.01, output: 0.02 }],
        ['qwen/phantom-2', { input: 0.005, output: 0.01 }],
      ]);
      const confirmed = new Set(['real-model']);

      const result = buildFallbackModels(makePricingSync(cache), 'qwen', confirmed);

      expect(result).toEqual([]);
    });
  });

  it('should deduplicate models by normalized ID', () => {
    const cache = new Map([
      ['openai/gpt-4o', { input: 0.01, output: 0.02 }],
      ['openai/gpt-4o', { input: 0.01, output: 0.02 }],
    ]);

    const result = buildFallbackModels(makePricingSync(cache), 'openai');

    expect(result).toHaveLength(1);
  });

  it('should use default context window when not provided', () => {
    const cache = new Map([['openai/gpt-4o', { input: 0.01, output: 0.02 }]]);

    const result = buildFallbackModels(makePricingSync(cache), 'openai');

    expect(result[0].contextWindow).toBe(128000);
  });

  it('should use provided context window', () => {
    const cache = new Map([
      ['openai/gpt-4o', { input: 0.01, output: 0.02, contextWindow: 200000 }],
    ]);

    const result = buildFallbackModels(makePricingSync(cache), 'openai');

    expect(result[0].contextWindow).toBe(200000);
  });

  it('should use model ID as displayName when none provided', () => {
    const cache = new Map([['openai/gpt-4o', { input: 0.01, output: 0.02 }]]);

    const result = buildFallbackModels(makePricingSync(cache), 'openai');

    expect(result[0].displayName).toBe('gpt-4o');
  });
});

describe('findOpenRouterPrefix', () => {
  it('should return prefix for known provider', () => {
    expect(findOpenRouterPrefix('openai')).toBe('openai');
  });

  it('should return prefix via alias', () => {
    expect(findOpenRouterPrefix('google')).toBeTruthy();
  });

  it('should return null for unknown provider', () => {
    expect(findOpenRouterPrefix('totally-unknown')).toBeNull();
  });

  it('should be case-insensitive', () => {
    expect(findOpenRouterPrefix('OpenAI')).toBe('openai');
  });

  it('should resolve via display name', () => {
    expect(findOpenRouterPrefix('Mistral')).toBeTruthy();
  });
});

describe('lookupWithVariants', () => {
  it('should return exact match', () => {
    const cache = new Map([['openai/gpt-4o', { input: 0.01, output: 0.02 }]]);

    const result = lookupWithVariants(makePricingSync(cache), 'openai', 'gpt-4o');

    expect(result).toEqual({ input: 0.01, output: 0.02 });
  });

  it('should try dot variant', () => {
    const cache = new Map([['anthropic/claude-sonnet-4.6', { input: 0.01, output: 0.02 }]]);

    const result = lookupWithVariants(makePricingSync(cache), 'anthropic', 'claude-sonnet-4-6');

    expect(result).toEqual({ input: 0.01, output: 0.02 });
  });

  it('should try dash variant', () => {
    const cache = new Map([['anthropic/claude-sonnet-4-6', { input: 0.01, output: 0.02 }]]);

    const result = lookupWithVariants(makePricingSync(cache), 'anthropic', 'claude-sonnet-4.6');

    expect(result).toEqual({ input: 0.01, output: 0.02 });
  });

  it('should try stripping date suffix', () => {
    const cache = new Map([['openai/gpt-4o', { input: 0.01, output: 0.02 }]]);

    const result = lookupWithVariants(makePricingSync(cache), 'openai', 'gpt-4o-20250301');

    expect(result).toEqual({ input: 0.01, output: 0.02 });
  });

  it('should try stripping date suffix with dot variant', () => {
    const cache = new Map([['anthropic/claude-sonnet-4.5', { input: 0.01, output: 0.02 }]]);

    const result = lookupWithVariants(
      makePricingSync(cache),
      'anthropic',
      'claude-sonnet-4-5-20250929',
    );

    expect(result).toEqual({ input: 0.01, output: 0.02 });
  });

  it('should return null when no match found', () => {
    const cache = new Map<string, { input: number; output: number }>();

    const result = lookupWithVariants(makePricingSync(cache), 'openai', 'nonexistent');

    expect(result).toBeNull();
  });
});

describe('buildSubscriptionFallbackModels', () => {
  it('should return empty for providers with no known models', () => {
    const cache = new Map([['openai/gpt-4o', { input: 0.01, output: 0.02 }]]);

    const result = buildSubscriptionFallbackModels(makePricingSync(cache), 'unknown-provider');

    expect(result).toEqual([]);
  });

  it('should return models for known subscription providers', () => {
    const cache = new Map([
      ['anthropic/claude-opus-4-6', { input: 0.015, output: 0.075, displayName: 'Claude Opus' }],
    ]);

    const result = buildSubscriptionFallbackModels(makePricingSync(cache), 'anthropic');

    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle null pricingSync', () => {
    const result = buildSubscriptionFallbackModels(null, 'anthropic');

    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

describe('supplementWithKnownModels', () => {
  it('should return raw list unchanged for providers with no known models', () => {
    const raw = [
      {
        id: 'some-model',
        displayName: 'Some Model',
        provider: 'unknown',
        contextWindow: 128000,
        inputPricePerToken: 0.01,
        outputPricePerToken: 0.02,
        capabilityReasoning: false,
        capabilityCode: false,
        qualityScore: 3,
      },
    ];

    const result = supplementWithKnownModels(raw, 'unknown-provider');

    expect(result).toBe(raw);
    expect(result).toHaveLength(1);
  });

  it('should not add known models that are already covered', () => {
    const raw = [
      {
        id: 'claude-opus-4-6',
        displayName: 'Claude Opus',
        provider: 'anthropic',
        contextWindow: 200000,
        inputPricePerToken: 0.015,
        outputPricePerToken: 0.075,
        capabilityReasoning: false,
        capabilityCode: false,
        qualityScore: 3,
      },
    ];

    const result = supplementWithKnownModels(raw, 'anthropic');

    const opusEntries = result.filter((m) => m.id.startsWith('claude-opus-4'));
    expect(opusEntries).toHaveLength(1);
  });
});
