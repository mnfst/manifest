import { providerThinkingDefault } from '../src/thinking-defaults';
import type { ProviderParamSpec } from '../src/provider-params-spec';

const thinkingSpec: ProviderParamSpec = {
  key: 'thinking',
  control: {
    kind: 'toggle',
    label: 'Thinking mode',
    values: ['enabled', 'disabled'],
    default: 'enabled',
  },
};

describe('providerThinkingDefault', () => {
  it('returns the default from specs that declare the thinking key', () => {
    expect(providerThinkingDefault([thinkingSpec])).toBe('enabled');
  });

  it('returns undefined when no spec has a thinking key', () => {
    expect(
      providerThinkingDefault([
        {
          key: 'temperature',
          control: { kind: 'slider', label: 'Temperature', min: 0, max: 1, default: 1 },
        },
      ]),
    ).toBeUndefined();
    expect(providerThinkingDefault([])).toBeUndefined();
  });
});
