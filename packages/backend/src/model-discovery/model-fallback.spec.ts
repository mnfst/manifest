import {
  buildFallbackModels,
  buildModelsDevFallback,
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
    // Anthropic normalization: dashes and dots in version numbers normalize to the same ID
    const cache = new Map([
      ['anthropic/claude-sonnet-4-5-20250929', { input: 0.01, output: 0.02 }],
      ['anthropic/claude-sonnet-4.5-20250929', { input: 0.03, output: 0.04 }],
    ]);

    const result = buildFallbackModels(makePricingSync(cache), 'anthropic');

    // Both normalize to "claude-sonnet-4-5-20250929" via normalizeAnthropicShortModelId
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

  it('should try :free suffix variant', () => {
    const cache = new Map([['google/gemma-3n-e2b-it:free', { input: 0, output: 0 }]]);

    const result = lookupWithVariants(makePricingSync(cache), 'google', 'gemma-3n-e2b-it');

    expect(result).toEqual({ input: 0, output: 0 });
  });

  it('should return null when no match found', () => {
    const cache = new Map<string, { input: number; output: number }>();

    const result = lookupWithVariants(makePricingSync(cache), 'openai', 'nonexistent');

    expect(result).toBeNull();
  });

  it('should strip Google preview variant suffix', () => {
    const cache = new Map([['google/gemini-2.5-pro', { input: 0.00000125, output: 0.00001 }]]);

    const result = lookupWithVariants(
      makePricingSync(cache),
      'google',
      'gemini-2.5-pro-preview-03-25',
    );

    expect(result).toEqual({ input: 0.00000125, output: 0.00001 });
  });

  it('should strip Google exp variant suffix', () => {
    const cache = new Map([['google/gemini-2.5-pro', { input: 0.00000125, output: 0.00001 }]]);

    const result = lookupWithVariants(makePricingSync(cache), 'google', 'gemini-2.5-pro-exp-0325');

    expect(result).toEqual({ input: 0.00000125, output: 0.00001 });
  });

  it('should strip Google latest variant suffix', () => {
    const cache = new Map([['google/gemini-2.5-flash', { input: 0.0000003, output: 0.0000025 }]]);

    const result = lookupWithVariants(makePricingSync(cache), 'google', 'gemini-2.5-flash-latest');

    expect(result).toEqual({ input: 0.0000003, output: 0.0000025 });
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

  it('excludes Anthropic claude-*-fast pseudo-models that 404 at the API', () => {
    const cache = new Map([
      [
        'anthropic/claude-opus-4-8',
        { input: 0.015, output: 0.075, displayName: 'Claude Opus 4.8' },
      ],
      [
        'anthropic/claude-opus-4.8-fast',
        { input: 0.015, output: 0.075, displayName: 'Claude Opus 4.8 (fast)' },
      ],
    ]);

    const ids = buildSubscriptionFallbackModels(makePricingSync(cache), 'anthropic').map(
      (m) => m.id,
    );

    expect(ids).toContain('claude-opus-4-8');
    expect(ids.some((id) => id.includes('-fast'))).toBe(false);
  });

  it('surfaces claude-fable-5 even when the pricing cache lacks it', () => {
    // claude-fable-5 is a valid Anthropic subscription model with no pricing
    // cache entry; the knownModels fallback must still offer it.
    const ids = buildSubscriptionFallbackModels(makePricingSync(new Map()), 'anthropic').map(
      (m) => m.id,
    );

    expect(ids).toContain('claude-fable-5');
  });

  it('returns [] for opencode-go because its catalog is fetched dynamically', () => {
    // OpenCode Go has no hardcoded knownModels. The fallback path must stay empty
    // so we do not fabricate stale entries when the live catalog is unreachable.
    const result = buildSubscriptionFallbackModels(makePricingSync(new Map()), 'opencode-go');
    expect(result).toEqual([]);
  });

  describe('knownModelsMatch exact mode (gemini)', () => {
    it('includes only verbatim knownModel entries from the OpenRouter cache', () => {
      const cache = new Map([
        // Exact match for 'gemini-2.5-pro' → included
        [
          'google/gemini-2.5-pro',
          {
            input: 0.00000125,
            output: 0.00001,
            contextWindow: 1000000,
            displayName: 'Gemini 2.5 Pro',
          },
        ],
        // Exact match for 'gemini-2.5-flash' → included
        [
          'google/gemini-2.5-flash',
          {
            input: 0.0000003,
            output: 0.0000025,
            contextWindow: 1000000,
            displayName: 'Gemini 2.5 Flash',
          },
        ],
        // Exact current preview model → included because it is explicitly known
        [
          'google/gemini-3.1-pro-preview',
          {
            input: 0.000002,
            output: 0.000012,
            contextWindow: 1000000,
            displayName: 'Gemini 3.1 Pro Preview',
          },
        ],
        // Suffixed preview → excluded in exact mode
        [
          'google/gemini-2.5-pro-preview-06-05',
          {
            input: 0.00000125,
            output: 0.00001,
            contextWindow: 1000000,
            displayName: 'Gemini 2.5 Pro Preview',
          },
        ],
        // Suffixed lite preview → excluded in exact mode
        [
          'google/gemini-2.5-flash-lite-preview-06-17',
          {
            input: 0.0000001,
            output: 0.0000008,
            contextWindow: 1000000,
            displayName: 'Flash Lite Preview',
          },
        ],
        // Different provider — excluded
        [
          'openai/gpt-4o',
          { input: 0.0000025, output: 0.00001, contextWindow: 128000, displayName: 'GPT-4o' },
        ],
      ]);

      const result = buildSubscriptionFallbackModels(makePricingSync(cache), 'gemini');
      const ids = result.map((m) => m.id);

      expect(ids).toContain('gemini-2.5-pro');
      expect(ids).toContain('gemini-2.5-flash');
      expect(ids).toContain('gemini-3.1-pro-preview');
      // Suffixed variants excluded
      expect(ids).not.toContain('gemini-2.5-pro-preview-06-05');
      expect(ids).not.toContain('gemini-2.5-flash-lite-preview-06-17');
      // gemini-2.5-flash-lite knownModel not in cache → added as zero-cost directly
      expect(ids).toContain('gemini-2.5-flash-lite');
      expect(result.find((m) => m.id === 'gemini-2.5-flash-lite')!.inputPricePerToken).toBe(0);
    });

    it('compares exact match case-insensitively', () => {
      // OpenRouter may return 'gemini-2.5-pro' in lowercase, config has lowercase too
      const cache = new Map([
        [
          'google/gemini-2.5-pro',
          {
            input: 0.00000125,
            output: 0.00001,
            contextWindow: 1000000,
            displayName: 'Gemini 2.5 Pro',
          },
        ],
      ]);

      const result = buildSubscriptionFallbackModels(makePricingSync(cache), 'gemini');
      expect(result.map((m) => m.id)).toContain('gemini-2.5-pro');
    });

    it('contrast: prefix mode keeps suffix entries that exact mode would drop', () => {
      // Anthropic uses prefix mode: 'claude-opus-4-20260301' starts with 'claude-opus-4' → included
      // Gemini uses exact mode: 'gemini-2.5-pro-preview' does NOT equal 'gemini-2.5-pro' → excluded
      const anthropicCache = new Map([
        [
          'anthropic/claude-opus-4-20260301',
          {
            input: 0.000015,
            output: 0.000075,
            contextWindow: 200000,
            displayName: 'Claude Opus 4',
          },
        ],
      ]);
      const geminiCache = new Map([
        [
          'google/gemini-2.5-pro-preview',
          {
            input: 0.00000125,
            output: 0.00001,
            contextWindow: 1000000,
            displayName: 'Gemini 2.5 Pro Preview',
          },
        ],
      ]);

      const anthropicResult = buildSubscriptionFallbackModels(
        makePricingSync(anthropicCache),
        'anthropic',
      );
      const geminiResult = buildSubscriptionFallbackModels(makePricingSync(geminiCache), 'gemini');

      // Prefix: dated suffix accepted
      expect(anthropicResult.map((m) => m.id)).toContain('claude-opus-4-20260301');
      // Exact: preview suffix rejected
      expect(geminiResult.map((m) => m.id)).not.toContain('gemini-2.5-pro-preview');
      // Exact mode keeps explicit known preview IDs separate from their base model IDs.
      expect(geminiResult.map((m) => m.id)).toContain('gemini-2.5-pro');
      expect(geminiResult.map((m) => m.id)).toContain('gemini-2.5-flash');
      expect(geminiResult.map((m) => m.id)).toContain('gemini-2.5-flash-lite');
      expect(geminiResult.map((m) => m.id)).toContain('gemini-3.1-pro-preview');
      expect(geminiResult.map((m) => m.id)).toContain('gemini-3.1-flash-lite');
      expect(geminiResult.map((m) => m.id)).toContain('gemini-3.1-flash-lite-preview');
    });

    it('applies maxContextWindow cap from gemini subscription capabilities', () => {
      const cache = new Map([
        // OpenRouter reports 2M but Gemini subscription caps at 1M
        [
          'google/gemini-2.5-pro',
          {
            input: 0.00000125,
            output: 0.00001,
            contextWindow: 2000000,
            displayName: 'Gemini 2.5 Pro',
          },
        ],
      ]);

      const result = buildSubscriptionFallbackModels(makePricingSync(cache), 'gemini');
      const proModel = result.find((m) => m.id === 'gemini-2.5-pro');

      expect(proModel).toBeDefined();
      // Capped at Gemini subscription capability maxContextWindow (1000000)
      expect(proModel!.contextWindow).toBe(1000000);
    });

    it('returns all gemini knownModels as zero-cost when pricingSync returns nothing', () => {
      const result = buildSubscriptionFallbackModels(makePricingSync(new Map()), 'gemini');

      expect(result).toHaveLength(7);
      expect(result.map((m) => m.id).sort()).toEqual([
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.5-pro',
        'gemini-3-flash-preview',
        'gemini-3.1-flash-lite',
        'gemini-3.1-flash-lite-preview',
        'gemini-3.1-pro-preview',
      ]);
      for (const m of result) {
        expect(m.inputPricePerToken).toBe(0);
        expect(m.outputPricePerToken).toBe(0);
        expect(m.provider).toBe('gemini');
      }
    });
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

  it('keeps explicit gemini preview known models separate in exact mode', () => {
    const raw = [
      {
        id: 'gemini-3.1-flash-lite',
        displayName: 'Gemini 3.1 Flash-Lite',
        provider: 'gemini',
        contextWindow: 1000000,
        inputPricePerToken: 0.0000001,
        outputPricePerToken: 0.0000008,
        capabilityReasoning: false,
        capabilityCode: false,
        qualityScore: 3,
      },
    ];

    const result = supplementWithKnownModels(raw, 'gemini');
    const ids = result.map((m) => m.id);

    expect(ids).toContain('gemini-3.1-flash-lite');
    expect(ids).toContain('gemini-3.1-flash-lite-preview');
  });
});

describe('buildModelsDevFallback', () => {
  it('should return models from models.dev sync for a provider', () => {
    const mockSync = {
      getModelsForProvider: jest.fn().mockReturnValue([
        {
          id: 'claude-opus-4-6',
          name: 'Claude Opus 4.6',
          contextWindow: 1000000,
          inputPricePerToken: 0.000005,
          outputPricePerToken: 0.000025,
          reasoning: true,
          toolCall: true,
        },
        {
          id: 'claude-sonnet-4-6',
          name: 'Claude Sonnet 4.6',
          contextWindow: 200000,
          inputPricePerToken: 0.000003,
          outputPricePerToken: 0.000015,
          reasoning: false,
        },
      ]),
    };

    const result = buildModelsDevFallback(mockSync, 'anthropic');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('claude-opus-4-6');
    expect(result[0].displayName).toBe('Claude Opus 4.6');
    expect(result[0].provider).toBe('anthropic');
    expect(result[0].inputPricePerToken).toBe(0.000005);
    expect(result[0].contextWindow).toBe(1000000);
    expect(result[0].capabilityReasoning).toBe(true);
    expect(result[1].capabilityReasoning).toBe(false);
  });

  it('should return empty when sync is null', () => {
    expect(buildModelsDevFallback(null, 'anthropic')).toEqual([]);
  });

  it('should return empty when provider has no models', () => {
    const mockSync = {
      getModelsForProvider: jest.fn().mockReturnValue([]),
    };
    expect(buildModelsDevFallback(mockSync, 'unknown')).toEqual([]);
  });

  it('should use default context window when not provided', () => {
    const mockSync = {
      getModelsForProvider: jest
        .fn()
        .mockReturnValue([
          { id: 'test-model', name: 'Test', inputPricePerToken: 0.01, outputPricePerToken: 0.02 },
        ]),
    };

    const result = buildModelsDevFallback(mockSync, 'openai');

    expect(result[0].contextWindow).toBe(128000);
  });

  it('should use model id as displayName when name is empty', () => {
    const mockSync = {
      getModelsForProvider: jest
        .fn()
        .mockReturnValue([
          { id: 'unnamed-model', name: '', inputPricePerToken: 0.01, outputPricePerToken: 0.02 },
        ]),
    };

    const result = buildModelsDevFallback(mockSync, 'openai');

    expect(result[0].displayName).toBe('unnamed-model');
  });

  it('should propagate toolCall as capabilityCode', () => {
    const mockSync = {
      getModelsForProvider: jest.fn().mockReturnValue([
        {
          id: 'tool-model',
          name: 'Tool Model',
          inputPricePerToken: 0.01,
          outputPricePerToken: 0.02,
          reasoning: false,
          toolCall: true,
        },
      ]),
    };

    const result = buildModelsDevFallback(mockSync, 'openai');

    expect(result[0].capabilityCode).toBe(true);
    expect(result[0].capabilityReasoning).toBe(false);
  });

  it('should default reasoning to false when not provided', () => {
    const mockSync = {
      getModelsForProvider: jest.fn().mockReturnValue([
        {
          id: 'no-caps',
          name: 'No Caps',
          inputPricePerToken: 0.01,
          outputPricePerToken: 0.02,
          // no reasoning or toolCall
        },
      ]),
    };

    const result = buildModelsDevFallback(mockSync, 'openai');

    expect(result[0].capabilityReasoning).toBe(false);
    expect(result[0].capabilityCode).toBe(false);
  });

  it('should include models with null pricing', () => {
    const mockSync = {
      getModelsForProvider: jest.fn().mockReturnValue([
        {
          id: 'null-price',
          name: 'Null Price',
          inputPricePerToken: null,
          outputPricePerToken: null,
        },
      ]),
    };

    const result = buildModelsDevFallback(mockSync, 'openai');

    expect(result).toHaveLength(1);
    expect(result[0].inputPricePerToken).toBeNull();
    expect(result[0].outputPricePerToken).toBeNull();
  });

  it('should set qualityScore to 3 for all models', () => {
    const mockSync = {
      getModelsForProvider: jest.fn().mockReturnValue([
        { id: 'model-1', name: 'Model 1', inputPricePerToken: 0.01, outputPricePerToken: 0.02 },
        { id: 'model-2', name: 'Model 2', inputPricePerToken: 0.05, outputPricePerToken: 0.1 },
      ]),
    };

    const result = buildModelsDevFallback(mockSync, 'anthropic');

    for (const m of result) {
      expect(m.qualityScore).toBe(3);
    }
  });
});

describe('lookupWithVariants OpenRouter name aliases', () => {
  it('should resolve voxtral-small-2507 to voxtral-small-24b-2507', () => {
    const cache = new Map([
      ['mistralai/voxtral-small-24b-2507', { input: 0.0000001, output: 0.0000003 }],
    ]);

    const result = lookupWithVariants(makePricingSync(cache), 'mistralai', 'voxtral-small-2507');

    expect(result).toEqual({ input: 0.0000001, output: 0.0000003 });
  });

  it('should resolve voxtral-small-latest via alias then -latest stripping', () => {
    const cache = new Map([
      ['mistralai/voxtral-small-24b-2507', { input: 0.0000001, output: 0.0000003 }],
    ]);

    const result = lookupWithVariants(makePricingSync(cache), 'mistralai', 'voxtral-small-latest');

    expect(result).toEqual({ input: 0.0000001, output: 0.0000003 });
  });

  it('should resolve open-mistral-nemo to mistral-nemo via alias', () => {
    const cache = new Map([['mistralai/mistral-nemo', { input: 0.00000015, output: 0.00000015 }]]);

    const result = lookupWithVariants(makePricingSync(cache), 'mistralai', 'open-mistral-nemo');

    expect(result).toEqual({ input: 0.00000015, output: 0.00000015 });
  });
});

describe('lookupWithVariants -latest stripping', () => {
  it('should strip -latest and find dated variant in cache', () => {
    const cache = new Map([
      ['mistralai/ministral-14b-2512', { input: 0.0000002, output: 0.0000002 }],
    ]);

    const result = lookupWithVariants(makePricingSync(cache), 'mistralai', 'ministral-14b-latest');

    expect(result).toEqual({ input: 0.0000002, output: 0.0000002 });
  });

  it('should not strip -latest when model does not end with it', () => {
    const cache = new Map<string, { input: number; output: number }>();

    const result = lookupWithVariants(makePricingSync(cache), 'mistralai', 'mistral-medium-2508');

    expect(result).toBeNull();
  });
});

describe('lookupWithVariants edge cases', () => {
  it('should not double-apply dot variant when model already uses dots', () => {
    const cache = new Map([['openai/gpt-4.1', { input: 0.01, output: 0.02 }]]);

    // Already has a dot, so -(\d+)-(\d) pattern won't match
    const result = lookupWithVariants(makePricingSync(cache), 'openai', 'gpt-4.1');

    expect(result).toEqual({ input: 0.01, output: 0.02 });
  });

  it('should prefer exact match over :free suffix', () => {
    const cache = new Map([
      ['google/gemma-3n-e2b-it', { input: 0.01, output: 0.02 }],
      ['google/gemma-3n-e2b-it:free', { input: 0, output: 0 }],
    ]);

    const result = lookupWithVariants(makePricingSync(cache), 'google', 'gemma-3n-e2b-it');

    // Should return exact match, not :free variant
    expect(result).toEqual({ input: 0.01, output: 0.02 });
  });

  it('should handle model names with multiple dashes and digits', () => {
    const cache = new Map([['anthropic/claude-sonnet-4.5', { input: 0.01, output: 0.02 }]]);

    // claude-sonnet-4-5 -> dot variant: claude-sonnet-4.5
    const result = lookupWithVariants(makePricingSync(cache), 'anthropic', 'claude-sonnet-4-5');

    expect(result).toEqual({ input: 0.01, output: 0.02 });
  });

  it('should try date-stripped + dot variant as last resort', () => {
    const cache = new Map([['anthropic/claude-opus-4.6', { input: 0.015, output: 0.075 }]]);

    // claude-opus-4-6-20260301 -> strip date -> claude-opus-4-6 -> dot variant -> claude-opus-4.6
    const result = lookupWithVariants(
      makePricingSync(cache),
      'anthropic',
      'claude-opus-4-6-20260301',
    );

    expect(result).toEqual({ input: 0.015, output: 0.075 });
  });
});
