import {
  getProviderParamSpecs,
  pickProviderCompatibleParams,
  type ProviderParamSpecRegistry,
} from '../src/provider-params-spec';

const registry: ProviderParamSpecRegistry = {
  'anthropic:api_key': {
    base: [
      {
        key: 'max_tokens',
        control: { kind: 'number', label: 'Max tokens', min: 1, default: 4096 },
      },
      {
        key: 'temperature',
        control: { kind: 'slider', label: 'Temperature', min: 0, max: 1, step: 0.1, default: 1 },
      },
      {
        key: 'top_p',
        control: { kind: 'slider', label: 'Top P', min: 0, max: 1, step: 0.01, default: 1 },
      },
      {
        key: 'top_k',
        control: { kind: 'number', label: 'Top K', min: 0, default: 0 },
      },
    ],
  },
  'deepseek:api_key': {
    base: [
      {
        key: 'thinking',
        control: {
          kind: 'toggle',
          label: 'Thinking mode',
          values: ['enabled', 'disabled'],
          default: 'enabled',
        },
      },
    ],
  },
};

describe('provider-params-spec', () => {
  describe('getProviderParamSpecs', () => {
    it('returns the provider entries case-insensitively', () => {
      expect(getProviderParamSpecs(registry, 'deepseek', 'api_key')).toHaveLength(1);
      expect(getProviderParamSpecs(registry, 'DeepSeek', 'api_key')).toHaveLength(1);
      expect(getProviderParamSpecs(registry, 'Anthropic', 'api_key')).toHaveLength(4);
    });

    it('returns empty for unknown providers, missing input, and auth types with no entry', () => {
      expect(getProviderParamSpecs(registry, 'openai', 'api_key')).toEqual([]);
      expect(getProviderParamSpecs(registry, 'deepseek', 'subscription')).toEqual([]);
      expect(getProviderParamSpecs(registry, 'anthropic', 'subscription')).toEqual([]);
      expect(getProviderParamSpecs(registry, undefined, 'api_key')).toEqual([]);
      expect(getProviderParamSpecs(registry, 'deepseek', undefined)).toEqual([]);
      expect(getProviderParamSpecs(registry, '', 'api_key')).toEqual([]);
    });

    it('returns empty for object prototype keys', () => {
      expect(getProviderParamSpecs(registry, '__proto__', 'api_key')).toEqual([]);
      expect(getProviderParamSpecs(registry, 'constructor', 'api_key')).toEqual([]);
    });

    it('uses a model override wholesale when one is declared', () => {
      const localRegistry: ProviderParamSpecRegistry = {
        'unit:api_key': {
          base: [
            {
              key: 'temperature',
              control: { kind: 'slider', label: 'Temperature', min: 0, max: 2, default: 1 },
            },
          ],
          byModel: {
            'unit/special:model': [
              {
                key: 'reasoning_effort',
                control: {
                  kind: 'select',
                  label: 'Reasoning effort',
                  values: ['low', 'medium', 'high'],
                  default: 'medium',
                },
              },
            ],
          },
        },
      };

      expect(
        getProviderParamSpecs(localRegistry, 'unit', 'api_key', 'unit/special:model').map(
          (s) => s.key,
        ),
      ).toEqual(['reasoning_effort']);
      expect(
        getProviderParamSpecs(localRegistry, 'unit', 'api_key', 'other-model').map((s) => s.key),
      ).toEqual(['temperature']);
    });
  });

  describe('pickProviderCompatibleParams', () => {
    it('keeps keys the specs consume', () => {
      expect(
        pickProviderCompatibleParams(
          { thinking: 'disabled' },
          getProviderParamSpecs(registry, 'deepseek', 'api_key', 'deepseek-v4'),
        ),
      ).toEqual({ thinking: 'disabled' });
      expect(
        pickProviderCompatibleParams(
          {
            max_tokens: 2048,
            temperature: 0.4,
            top_p: 0.8,
            top_k: 40,
            thinking: { type: 'enabled', budget_tokens: 1024 },
          },
          getProviderParamSpecs(registry, 'anthropic', 'api_key', 'claude-sonnet-4-6'),
        ),
      ).toEqual({ max_tokens: 2048, temperature: 0.4, top_p: 0.8, top_k: 40 });
    });

    it('drops keys the specs do not consume', () => {
      expect(
        pickProviderCompatibleParams(
          { thinking: 'disabled' },
          getProviderParamSpecs(registry, 'openai', 'api_key', 'gpt-4o'),
        ),
      ).toEqual({});
      expect(
        pickProviderCompatibleParams(
          { temperature: 0.4 },
          getProviderParamSpecs(registry, 'anthropic', 'subscription', 'claude-sonnet-4-6'),
        ),
      ).toEqual({});
    });

    it('returns an empty object when the input has no keys at all', () => {
      expect(
        pickProviderCompatibleParams(
          {},
          getProviderParamSpecs(registry, 'deepseek', 'api_key', 'deepseek-v4'),
        ),
      ).toEqual({});
    });

    it('does not mutate the input', () => {
      const input = { thinking: 'enabled' };
      const out = pickProviderCompatibleParams(
        input,
        getProviderParamSpecs(registry, 'deepseek', 'api_key', 'deepseek-v4'),
      );
      expect(out).not.toBe(input);
      expect(input.thinking).toEqual('enabled');
    });
  });
});
