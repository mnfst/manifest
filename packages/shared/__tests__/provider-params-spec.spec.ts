import {
  compareProviderParamSpecs,
  deleteProviderParamValue,
  expandConfiguredParamDefaults,
  getProviderParamValue,
  getProviderParamSpecs,
  isParamApplicability,
  isProviderParamPath,
  omitProviderInapplicableParams,
  pickProviderCompatibleParams,
  providerParamIsApplicable,
  setProviderParamValue,
  type ProviderParamSpecCatalog,
} from '../src/provider-params-spec';

const catalog: ProviderParamSpecCatalog = [
  {
    provider: 'anthropic',
    authType: 'api_key',
    model: 'claude-sonnet-4-6',
    path: 'thinking.budget_tokens',
    type: 'integer',
    label: 'Thinking budget',
    default: 4096,
    range: { min: 1024, max: 32768, step: 1024 },
    group: 'reasoning',
    applicability: { only: { 'thinking.type': 'enabled' } },
  },
  {
    provider: 'anthropic',
    authType: 'api_key',
    model: 'claude-sonnet-4-6',
    path: 'thinking.type',
    type: 'enum',
    label: 'Thinking mode',
    default: 'disabled',
    values: ['disabled', 'adaptive', 'enabled'],
    group: 'reasoning',
  },
  {
    provider: 'anthropic',
    authType: 'api_key',
    model: 'claude-sonnet-4-6',
    path: 'temperature',
    type: 'number',
    label: 'Temperature',
    default: 1,
    range: { min: 0, max: 1, step: 0.1 },
    group: 'sampling',
    applicability: { except: { 'thinking.type': ['enabled', 'adaptive'] } },
  },
  {
    provider: 'anthropic',
    authType: 'api_key',
    model: 'claude-sonnet-4-6',
    path: 'top_p',
    type: 'number',
    label: 'Top P',
    default: 1,
    range: { min: 0, max: 1, step: 0.01 },
    group: 'sampling',
    applicability: {
      except: [{ 'thinking.type': ['enabled', 'adaptive'] }, { temperature: { not: 1 } }],
    },
  },
  {
    provider: 'openai',
    authType: 'api_key',
    model: 'gpt-5',
    path: 'reasoning_effort',
    type: 'enum',
    label: 'Reasoning effort',
    default: 'medium',
    values: ['minimal', 'low', 'medium', 'high'],
    group: 'reasoning',
  },
];

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
    });

    it('is provider-case-insensitive and keeps nested model ids literal', () => {
      expect(
        getProviderParamSpecs(catalog, 'Anthropic', 'api_key', 'claude-sonnet-4-6'),
      ).toHaveLength(4);
      expect(getProviderParamSpecs(catalog, 'anthropic', 'api_key', 'claude:sonnet/4-6')).toEqual(
        [],
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
        compareProviderParamSpecs({ ...catalog[0], path: 'thinking.alpha' }, catalog[0]),
      ).toBeLessThan(0);
    });
  });

  describe('providerParamIsApplicable', () => {
    it('supports only constraints', () => {
      const spec = catalog[0];
      expect(providerParamIsApplicable(spec, { thinking: { type: 'enabled' } })).toBe(true);
      expect(providerParamIsApplicable(spec, { thinking: { type: 'adaptive' } })).toBe(false);
    });

    it('supports except constraints', () => {
      const spec = catalog[2];
      expect(providerParamIsApplicable(spec, { thinking: { type: 'disabled' } })).toBe(true);
      expect(providerParamIsApplicable(spec, { thinking: { type: 'adaptive' } })).toBe(false);
      expect(providerParamIsApplicable(spec, { thinking: { type: 'enabled' } })).toBe(false);
    });

    it('supports negated except constraints', () => {
      const spec = catalog[3];
      expect(providerParamIsApplicable(spec, { temperature: 1 })).toBe(true);
      expect(providerParamIsApplicable(spec, { temperature: 0.2 })).toBe(false);
    });

    it('does not match primitive conditions against object values', () => {
      expect(providerParamIsApplicable(catalog[3], { temperature: { value: 1 } })).toBe(false);
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
      expect(isParamApplicability({ conflictsWith: ['temperature'] })).toBe(false);
      expect(isParamApplicability({ except: { temperature: { not: 1, value: 0 } } })).toBe(false);
      expect(isParamApplicability({ except: [] })).toBe(false);
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
      expect(expandConfiguredParamDefaults({ temperature: 0.5 }, catalog)).toEqual({
        temperature: 0.5,
      });
    });

    it('adds only applicable nested defaults under configured roots', () => {
      expect(expandConfiguredParamDefaults({ thinking: { type: 'disabled' } }, catalog)).toEqual({
        thinking: { type: 'disabled' },
      });
      expect(expandConfiguredParamDefaults({ thinking: { type: 'enabled' } }, catalog)).toEqual({
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
      expect(params).toEqual({
        temperature: 0.2,
        thinking: { type: 'enabled', budget_tokens: 4096 },
      });
    });
  });

  describe('setProviderParamValue', () => {
    it('rejects unsafe paths without polluting prototypes', () => {
      expect(() => setProviderParamValue({}, '__proto__.polluted', true)).toThrow(
        'Invalid provider param path',
      );
      expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    });
  });
});
