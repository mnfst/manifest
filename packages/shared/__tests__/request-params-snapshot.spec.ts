import { snapshotRequestParams } from '../src/request-params-snapshot';
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

const anthropicThinkingSpecs: ProviderParamSpec[] = [
  {
    key: 'top_p',
    control: { kind: 'slider', label: 'Top P', min: 0, max: 1, step: 0.01, default: 1 },
    dependencies: [
      {
        effect: 'omit',
        when: { key: 'thinking.type', values: ['adaptive', 'enabled'] },
      },
    ],
  },
  {
    key: 'top_k',
    control: { kind: 'number', label: 'Top K', min: 0, default: 0 },
    dependencies: [
      {
        effect: 'omit',
        when: { key: 'thinking.type', values: ['adaptive', 'enabled'] },
      },
    ],
  },
  {
    key: 'type',
    group: { key: 'thinking', label: 'Thinking' },
    control: {
      kind: 'select',
      label: 'Thinking mode',
      values: ['disabled', 'adaptive', 'enabled'],
      default: 'disabled',
    },
  },
  {
    key: 'budget_tokens',
    group: { key: 'thinking', label: 'Thinking' },
    visibleWhen: { key: 'type', equals: 'enabled' },
    control: { kind: 'number', label: 'Budget tokens', min: 1024, default: 4096 },
  },
];

describe('snapshotRequestParams', () => {
  it('returns null when the route has no known param specs', () => {
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        modelParams: null,
        specs: [],
      }),
    ).toBeNull();
  });

  it("falls back to the provider's own default for known keys when nothing was overridden", () => {
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        modelParams: null,
        specs: [thinkingSpec],
      }),
    ).toEqual({ thinking: 'enabled' });
  });

  it("records the user's saved per-route override when present", () => {
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        modelParams: { thinking: 'disabled' },
        specs: [thinkingSpec],
      }),
    ).toEqual({ thinking: 'disabled' });
  });

  it('client body wins by presence over saved per-route params', () => {
    expect(
      snapshotRequestParams({
        body: { thinking: 'enabled', messages: [] },
        modelParams: { thinking: 'disabled' },
        specs: [thinkingSpec],
      }),
    ).toEqual({ thinking: 'enabled' });
  });

  it('only emits keys from the route specs — extraneous body fields stay out of the snapshot', () => {
    const result = snapshotRequestParams({
      body: { messages: [], temperature: 0.7, thinking: 'enabled' },
      modelParams: null,
      specs: [thinkingSpec],
    });
    expect(result).toEqual({ thinking: 'enabled' });
    expect(Object.keys(result!)).not.toContain('temperature');
    expect(Object.keys(result!)).not.toContain('messages');
  });

  it('records grouped params under the group storage key', () => {
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        modelParams: { thinking: { type: 'enabled', budget_tokens: 8192 } },
        specs: anthropicThinkingSpecs,
      }),
    ).toEqual({ thinking: { type: 'enabled', budget_tokens: 8192 } });
  });

  it('uses visible grouped defaults when no grouped override exists', () => {
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        modelParams: null,
        specs: anthropicThinkingSpecs,
      }),
    ).toEqual({ top_p: 1, top_k: 0, thinking: { type: 'disabled' } });
  });

  it('omits snapshot params whose provider dependency is active', () => {
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        modelParams: { top_p: 0.4, top_k: 3, thinking: { type: 'adaptive' } },
        specs: anthropicThinkingSpecs,
      }),
    ).toEqual({ thinking: { type: 'adaptive' } });
  });
});
