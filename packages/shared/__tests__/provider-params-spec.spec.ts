import {
  compareProviderParamSpecs,
  deleteProviderParamValue,
  expandConfiguredParamDefaults,
  getProviderModelCapabilities,
  getProviderParamValue,
  getProviderParamSpecs,
  isParamApplicability,
  isProviderParamPath,
  omitProviderInapplicableParams,
  pickProviderCompatibleParams,
  providerParamIsApplicable,
  providerParamValueIsValid,
  setProviderParamValue,
  type ProviderParamSpecCatalog,
} from '../src/provider-params-spec';
import { normalizeProviderParamProviderId as normalizeProviderParamProviderIdFromBarrel } from '../src';

const catalog: ProviderParamSpecCatalog = [
  {
    provider: 'anthropic',
    authType: 'api_key',
    model: 'claude-sonnet-4-6',
    capabilities: ['text', 'stream', 'tools'],
    params: [
      {
        path: 'thinking.budget_tokens',
        type: 'integer',
        label: 'Thinking budget',
        description: 'Maximum Anthropic extended thinking token budget.',
        default: 4096,
        range: { min: 1024, max: 32768, step: 1024 },
        group: 'reasoning',
        applicability: { only: { 'thinking.type': 'enabled' } },
      },
      {
        path: 'thinking.type',
        type: 'enum',
        label: 'Thinking mode',
        description: 'Controls Anthropic thinking mode.',
        default: 'disabled',
        values: ['disabled', 'adaptive', 'enabled'],
        group: 'reasoning',
      },
      {
        path: 'temperature',
        type: 'number',
        label: 'Temperature',
        description: 'Controls sampling randomness.',
        default: 1,
        range: { min: 0, max: 1, step: 0.1 },
        group: 'sampling',
        applicability: { except: { 'thinking.type': ['enabled', 'adaptive'] } },
      },
      {
        path: 'top_p',
        type: 'number',
        label: 'Top P',
        description: 'Controls nucleus sampling.',
        default: 1,
        range: { min: 0, max: 1, step: 0.01 },
        group: 'sampling',
        applicability: {
          except: [{ 'thinking.type': ['enabled', 'adaptive'] }, { temperature: { not: 1 } }],
        },
      },
    ],
  },
  {
    provider: 'openai',
    authType: 'api_key',
    model: 'gpt-5',
    params: [
      {
        path: 'reasoning_effort',
        type: 'enum',
        label: 'Reasoning effort',
        description: 'Controls OpenAI reasoning effort.',
        default: 'medium',
        values: ['minimal', 'low', 'medium', 'high'],
        group: 'reasoning',
      },
    ],
  },
  {
    provider: 'z-ai',
    authType: 'subscription',
    model: 'glm-5.1',
    params: [
      {
        path: 'max_tokens',
        type: 'integer',
        label: 'Max tokens',
        description: 'Maximum tokens.',
        group: 'generation_length',
      },
    ],
  },
  {
    provider: 'deepseek',
    authType: 'api_key',
    model: 'deepseek-v4-pro',
    capabilities: ['text', 'stream'],
    params: [
      {
        path: 'reasoning_effort',
        type: 'enum',
        label: 'Reasoning effort',
        description: 'Controls DeepSeek reasoning effort.',
        default: 'medium',
        values: ['low', 'medium', 'high'],
        group: 'reasoning',
      },
    ],
  },
];

const anthropicSpecs = getProviderParamSpecs(catalog, 'anthropic', 'api_key', 'claude-sonnet-4-6');
const thinkingBudgetSpec = anthropicSpecs.find((spec) => spec.path === 'thinking.budget_tokens')!;
const thinkingTypeSpec = anthropicSpecs.find((spec) => spec.path === 'thinking.type')!;
const temperatureSpec = anthropicSpecs.find((spec) => spec.path === 'temperature')!;
const topPSpec = anthropicSpecs.find((spec) => spec.path === 'top_p')!;

describe('provider-params-spec', () => {
  describe('getProviderParamSpecs', () => {
    it('returns only exact provider/auth/model matches', () => {
      expect(
        getProviderParamSpecs(catalog, 'anthropic', 'api_key', 'claude-sonnet-4-6'),
      ).toHaveLength(4);
      expect(
        getProviderParamSpecs(catalog, 'anthropic', 'subscription', 'claude-sonnet-4-6'),
      ).toEqual([]);
      expect(getProviderParamSpecs(catalog, 'openai', 'api_key', 'gpt-5')).toHaveLength(1);
      expect(getProviderParamSpecs(catalog, undefined, 'api_key', 'gpt-5')).toEqual([]);
      expect(getProviderParamSpecs(catalog, 'openai', undefined, 'gpt-5')).toEqual([]);
      expect(getProviderParamSpecs(catalog, 'openai', 'api_key', undefined)).toEqual([]);
    });

    it('is provider-case-insensitive and keeps nested model ids literal', () => {
      expect(
        getProviderParamSpecs(catalog, 'Anthropic', 'api_key', 'claude-sonnet-4-6'),
      ).toHaveLength(4);
      expect(getProviderParamSpecs(catalog, 'anthropic', 'api_key', 'claude:sonnet/4-6')).toEqual(
        [],
      );
    });

    it('resolves gateway models to the underlying provider specs', () => {
      // OpenCode Go (subscription gateway) -> DeepSeek's native api_key specs.
      const specs = getProviderParamSpecs(
        catalog,
        'opencode-go',
        'subscription',
        'opencode-go/deepseek-v4-pro',
      );
      expect(specs.map((spec) => spec.path)).toEqual(['reasoning_effort']);
      expect(specs[0].provider).toBe('deepseek');
      expect(specs[0].model).toBe('deepseek-v4-pro');
    });

    it('returns [] for gateway models whose underlying provider is absent from the catalog', () => {
      // moonshot (kimi) is not in the catalog.
      expect(
        getProviderParamSpecs(catalog, 'opencode-go', 'subscription', 'opencode-go/kimi-k2.6'),
      ).toEqual([]);
      // Xiaomi is not in this params catalog.
      expect(
        getProviderParamSpecs(catalog, 'opencode-go', 'subscription', 'opencode-go/mimo-v2.5'),
      ).toEqual([]);
    });

    it('matches catalog provider aliases against Manifest provider IDs', () => {
      const specs = getProviderParamSpecs(catalog, 'zai', 'subscription', 'glm-5.1');

      expect(specs).toHaveLength(1);
      expect(specs[0].provider).toBe('zai');
    });

    it('exports provider alias normalization through the shared package barrel', () => {
      expect(normalizeProviderParamProviderIdFromBarrel('zai')).toBe('zai');
      expect(normalizeProviderParamProviderIdFromBarrel('z-ai')).toBe('zai');
      expect(normalizeProviderParamProviderIdFromBarrel('unknown-provider')).toBe(
        'unknown-provider',
      );
    });

    it('orders semantic groups and dependency type params before dependent siblings', () => {
      const paths = getProviderParamSpecs(catalog, 'anthropic', 'api_key', 'claude-sonnet-4-6').map(
        (spec) => spec.path,
      );
      expect(paths).toEqual(['temperature', 'top_p', 'thinking.type', 'thinking.budget_tokens']);
    });

    it('falls back to lexical path ordering for otherwise equivalent specs', () => {
      expect(
        compareProviderParamSpecs(
          { ...thinkingBudgetSpec, path: 'thinking.alpha' },
          thinkingBudgetSpec,
        ),
      ).toBeLessThan(0);
    });
  });

  describe('getProviderModelCapabilities', () => {
    it('returns the matched model capabilities case-insensitively', () => {
      expect(
        getProviderModelCapabilities(catalog, 'Anthropic', 'api_key', 'claude-sonnet-4-6'),
      ).toEqual(['text', 'stream', 'tools']);
    });

    it('returns null when inputs are incomplete or no capabilities are declared', () => {
      expect(getProviderModelCapabilities(catalog, undefined, 'api_key', 'gpt-5')).toBeNull();
      expect(getProviderModelCapabilities(catalog, 'openai', undefined, 'gpt-5')).toBeNull();
      expect(getProviderModelCapabilities(catalog, 'openai', 'api_key', undefined)).toBeNull();
      expect(getProviderModelCapabilities(catalog, 'openai', 'api_key', 'missing')).toBeNull();
      expect(getProviderModelCapabilities(catalog, 'openai', 'api_key', 'gpt-5')).toBeNull();
    });

    it('resolves gateway models to the underlying provider capabilities', () => {
      expect(
        getProviderModelCapabilities(
          catalog,
          'opencode-go',
          'subscription',
          'opencode-go/deepseek-v4-pro',
        ),
      ).toEqual(['text', 'stream']);
    });
  });

  describe('providerParamIsApplicable', () => {
    it('supports only constraints', () => {
      const spec = thinkingBudgetSpec;
      expect(providerParamIsApplicable(spec, { thinking: { type: 'enabled' } })).toBe(true);
      expect(providerParamIsApplicable(spec, { thinking: { type: 'adaptive' } })).toBe(false);
    });

    it('supports except constraints', () => {
      const spec = temperatureSpec;
      expect(providerParamIsApplicable(spec, { thinking: { type: 'disabled' } })).toBe(true);
      expect(providerParamIsApplicable(spec, { thinking: { type: 'adaptive' } })).toBe(false);
      expect(providerParamIsApplicable(spec, { thinking: { type: 'enabled' } })).toBe(false);
    });

    it('supports negated except constraints', () => {
      const spec = topPSpec;
      expect(providerParamIsApplicable(spec, {})).toBe(true);
      expect(providerParamIsApplicable(spec, { temperature: 1 })).toBe(true);
      expect(providerParamIsApplicable(spec, { temperature: 0.2 })).toBe(false);
    });

    it('treats defensive undefined conditions as matching only undefined values', () => {
      const spec = {
        ...temperatureSpec,
        applicability: { except: { temperature: undefined } },
      } as unknown as typeof temperatureSpec;

      expect(providerParamIsApplicable(spec, { temperature: undefined })).toBe(false);
      expect(providerParamIsApplicable(spec, { temperature: 1 })).toBe(true);
    });

    it('does not match primitive conditions against object values', () => {
      expect(providerParamIsApplicable(topPSpec, { temperature: { value: 1 } })).toBe(false);
    });
  });

  describe('isParamApplicability', () => {
    it('accepts the canonical availability schema', () => {
      expect(
        isParamApplicability({
          except: [{ 'thinking.type': ['enabled', 'adaptive'] }, { temperature: { not: 1 } }],
        }),
      ).toBe(true);
      expect(isParamApplicability({ only: { 'thinking.type': 'enabled' } })).toBe(true);
    });

    it('rejects unknown fields and malformed conditions', () => {
      expect(isParamApplicability(null)).toBe(false);
      expect(isParamApplicability({ conflictsWith: ['temperature'] })).toBe(false);
      expect(isParamApplicability({ only: { temperature: { nope: 1 } } })).toBe(false);
      expect(isParamApplicability({ except: { temperature: { not: 1, value: 0 } } })).toBe(false);
      expect(isParamApplicability({ except: [] })).toBe(false);
      expect(isParamApplicability({ except: ['temperature'] })).toBe(false);
      expect(isParamApplicability({ except: { temperature: undefined } })).toBe(false);
      expect(isParamApplicability({ except: { temperature: { value: 0 } } })).toBe(false);
      expect(isParamApplicability({})).toBe(false);
    });

    it('rejects prototype-polluting applicability paths', () => {
      expect(isParamApplicability({ except: { '__proto__.polluted': true } })).toBe(false);
      expect(isParamApplicability({ except: { 'constructor.prototype.polluted': true } })).toBe(
        false,
      );
      expect(isParamApplicability({ except: { 'thinking.prototype': true } })).toBe(false);
    });
  });

  describe('isProviderParamPath', () => {
    it('accepts dot paths and rejects unsafe path segments', () => {
      expect(isProviderParamPath('thinking.budget_tokens')).toBe(true);
      expect(isProviderParamPath('')).toBe(false);
      expect(isProviderParamPath('thinking.')).toBe(false);
      expect(isProviderParamPath('__proto__.polluted')).toBe(false);
      expect(isProviderParamPath('constructor.prototype.polluted')).toBe(false);
    });
  });

  describe('pickProviderCompatibleParams', () => {
    const specs = getProviderParamSpecs(catalog, 'anthropic', 'api_key', 'claude-sonnet-4-6');

    it('keeps only declared paths', () => {
      expect(
        pickProviderCompatibleParams(
          { temperature: 0.2, max_tokens: 1000, thinking: { type: 'disabled' }, top_p: 0.7 },
          specs,
        ),
      ).toEqual({ temperature: 0.2, thinking: { type: 'disabled' } });
    });

    it('keeps a conflicted param when the conflict path is still default', () => {
      expect(pickProviderCompatibleParams({ temperature: 1, top_p: 0.7 }, specs)).toEqual({
        temperature: 1,
        top_p: 0.7,
      });
    });

    it('omits params that become unavailable under selected values', () => {
      expect(
        pickProviderCompatibleParams(
          { temperature: 0.2, thinking: { type: 'enabled', budget_tokens: 8192 } },
          specs,
        ),
      ).toEqual({ thinking: { type: 'enabled', budget_tokens: 8192 } });
    });

    it('fills applicable nested sibling defaults for configured nested roots', () => {
      expect(pickProviderCompatibleParams({ thinking: { type: 'enabled' } }, specs)).toEqual({
        thinking: { type: 'enabled', budget_tokens: 4096 },
      });
    });
  });

  describe('providerParamValueIsValid', () => {
    it('validates enum membership and numeric ranges', () => {
      expect(providerParamValueIsValid(thinkingTypeSpec, 'enabled')).toBe(true);
      expect(providerParamValueIsValid(thinkingTypeSpec, 'unsupported')).toBe(false);
      expect(providerParamValueIsValid(temperatureSpec, 0.2)).toBe(true);
      expect(providerParamValueIsValid(temperatureSpec, 1.2)).toBe(false);
      expect(providerParamValueIsValid(thinkingBudgetSpec, 2048)).toBe(true);
      expect(providerParamValueIsValid(thinkingBudgetSpec, 2048.5)).toBe(false);
      expect(providerParamValueIsValid(thinkingBudgetSpec, 512)).toBe(false);
      expect(providerParamValueIsValid({ ...thinkingTypeSpec, values: undefined }, 'enabled')).toBe(
        false,
      );
      expect(
        providerParamValueIsValid({ ...thinkingTypeSpec, type: 'unknown' as 'enum' }, 'enabled'),
      ).toBe(false);
    });

    it('keeps boolean values as booleans', () => {
      const booleanSpec = {
        provider: 'test',
        authType: 'api_key',
        model: 'test-model',
        path: 'logprobs',
        type: 'boolean',
        label: 'Token log probabilities',
        description: 'Controls whether token log probabilities are requested.',
        default: false,
        group: 'observability',
      } as const;
      expect(providerParamValueIsValid(booleanSpec, true)).toBe(true);
      expect(providerParamValueIsValid(booleanSpec, 'true')).toBe(false);
    });

    it('keeps string values as strings', () => {
      const stringSpec = {
        ...thinkingTypeSpec,
        path: 'metadata.user',
        type: 'string',
        label: 'User',
        description: 'Provider metadata user id.',
        default: '',
        values: undefined,
      } as const;

      expect(providerParamValueIsValid(stringSpec, 'user-1')).toBe(true);
      expect(providerParamValueIsValid(stringSpec, 123)).toBe(false);
    });
  });

  describe('omitProviderInapplicableParams', () => {
    const specs = getProviderParamSpecs(catalog, 'anthropic', 'api_key', 'claude-sonnet-4-6');

    it('returns the same object when every configured param is still applicable', () => {
      const params = { temperature: 1 };
      expect(omitProviderInapplicableParams(params, specs)).toBe(params);
    });

    it('removes inapplicable nested values and prunes empty parents', () => {
      expect(
        omitProviderInapplicableParams(
          { thinking: { budget_tokens: 8192 }, temperature: 0.2 },
          specs,
        ),
      ).toEqual({ temperature: 0.2 });
    });

    it('removes inapplicable flat values', () => {
      expect(
        omitProviderInapplicableParams({ thinking: { type: 'enabled' }, temperature: 0.2 }, specs),
      ).toEqual({ thinking: { type: 'enabled' } });
    });
  });

  describe('expandConfiguredParamDefaults', () => {
    it('does not add nested defaults when the root is not configured', () => {
      expect(expandConfiguredParamDefaults({ temperature: 0.5 }, anthropicSpecs)).toEqual({
        temperature: 0.5,
      });
    });

    it('adds only applicable nested defaults under configured roots', () => {
      expect(
        expandConfiguredParamDefaults({ thinking: { type: 'disabled' } }, anthropicSpecs),
      ).toEqual({
        thinking: { type: 'disabled' },
      });
      expect(
        expandConfiguredParamDefaults({ thinking: { type: 'enabled' } }, anthropicSpecs),
      ).toEqual({
        thinking: { type: 'enabled', budget_tokens: 4096 },
      });
    });
  });

  describe('getProviderParamValue', () => {
    it('returns undefined for empty values and reads nested paths', () => {
      expect(getProviderParamValue(null, 'thinking.type')).toBeUndefined();
      expect(getProviderParamValue({ thinking: { type: 'enabled' } }, 'thinking.type')).toBe(
        'enabled',
      );
      expect(getProviderParamValue({ thinking: 'enabled' }, 'thinking.type')).toBeUndefined();
    });
  });

  describe('deleteProviderParamValue', () => {
    it('removes flat and nested values without mutating the input', () => {
      const params = { temperature: 0.2, thinking: { type: 'enabled', budget_tokens: 4096 } };

      expect(deleteProviderParamValue(params, 'temperature')).toEqual({
        thinking: { type: 'enabled', budget_tokens: 4096 },
      });
      expect(deleteProviderParamValue(params, 'thinking.budget_tokens')).toEqual({
        temperature: 0.2,
        thinking: { type: 'enabled' },
      });
      expect(deleteProviderParamValue({ thinking: 'enabled' }, 'thinking.budget_tokens')).toEqual({
        thinking: 'enabled',
      });
      expect(params).toEqual({
        temperature: 0.2,
        thinking: { type: 'enabled', budget_tokens: 4096 },
      });
    });
  });

  describe('setProviderParamValue', () => {
    it('sets nested values without mutating the input', () => {
      const params = { temperature: 0.2 };

      expect(setProviderParamValue(params, 'thinking.type', 'enabled')).toEqual({
        temperature: 0.2,
        thinking: { type: 'enabled' },
      });
      expect(params).toEqual({ temperature: 0.2 });
    });

    it('rejects unsafe paths without polluting prototypes', () => {
      expect(() => setProviderParamValue({}, '__proto__.polluted', true)).toThrow(
        'Invalid provider param path',
      );
      expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    });
  });
});
