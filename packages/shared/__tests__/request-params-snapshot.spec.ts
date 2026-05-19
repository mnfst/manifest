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

  it("client body wins by presence over saved per-route params", () => {
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
});
