import {
  PROVIDER_PARAM_SPECS,
  getProviderParamSpecs,
  pickProviderCompatibleParams,
  providerParamDefault,
  providerSupportsParam,
} from '../src/provider-params-spec';

describe('provider-params-spec', () => {
  describe('PROVIDER_PARAM_SPECS registry', () => {
    it('declares DeepSeek thinking with the right control shape + default', () => {
      const specs = PROVIDER_PARAM_SPECS.deepseek;
      expect(specs).toBeDefined();
      expect(specs).toHaveLength(1);
      expect(specs![0].key).toBe('thinking');
      expect(specs![0].control).toEqual({
        kind: 'toggle',
        values: ['enabled', 'disabled'],
        default: 'enabled',
      });
    });
  });

  describe('getProviderParamSpecs', () => {
    it('returns the provider entries case-insensitively', () => {
      expect(getProviderParamSpecs('deepseek')).toHaveLength(1);
      expect(getProviderParamSpecs('DeepSeek')).toHaveLength(1);
    });

    it('returns empty for unknown providers + missing input', () => {
      expect(getProviderParamSpecs('openai')).toEqual([]);
      expect(getProviderParamSpecs(undefined)).toEqual([]);
      expect(getProviderParamSpecs('')).toEqual([]);
    });
  });

  describe('providerSupportsParam', () => {
    it('is true for declared (provider, key) pairs', () => {
      expect(providerSupportsParam('deepseek', 'thinking')).toBe(true);
    });

    it('is false for providers whose spec does not declare the key', () => {
      expect(providerSupportsParam('openai', 'thinking')).toBe(false);
      expect(providerSupportsParam(undefined, 'thinking')).toBe(false);
    });
  });

  describe('providerParamDefault', () => {
    it('returns the control.default of the matching entry', () => {
      expect(providerParamDefault('deepseek', 'thinking')).toBe('enabled');
    });

    it('returns undefined when the provider/key pair is not in the spec', () => {
      expect(providerParamDefault('openai', 'thinking')).toBeUndefined();
      expect(providerParamDefault(undefined, 'thinking')).toBeUndefined();
    });
  });

  describe('pickProviderCompatibleParams', () => {
    it('keeps keys the provider consumes', () => {
      expect(
        pickProviderCompatibleParams('deepseek', { thinking: { type: 'disabled' } }),
      ).toEqual({ thinking: { type: 'disabled' } });
    });

    it('drops keys the provider does not consume (e.g. thinking on OpenAI)', () => {
      // Cast through unknown: the input shape is wider than the curated
      // RequestParamDefaults at runtime — callers may hand us a stale blob
      // and the function must trim it, not trust the static type.
      expect(
        pickProviderCompatibleParams('openai', { thinking: { type: 'disabled' } }),
      ).toEqual({});
    });

    it('returns an empty object when the input has no keys at all', () => {
      expect(pickProviderCompatibleParams('deepseek', {})).toEqual({});
    });

    it('handles undefined provider + missing keys without crashing', () => {
      expect(pickProviderCompatibleParams(undefined, { thinking: { type: 'enabled' } })).toEqual(
        {},
      );
    });

    it('does not mutate the input', () => {
      const input = { thinking: { type: 'enabled' as const } };
      const out = pickProviderCompatibleParams('deepseek', input);
      expect(out).not.toBe(input);
      expect(input.thinking).toEqual({ type: 'enabled' });
    });
  });
});
