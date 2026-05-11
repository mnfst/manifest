import { snapshotRequestParams } from '../src/request-params-snapshot';

describe('snapshotRequestParams', () => {
  it('returns null when the provider has no known param keys (e.g. OpenAI)', () => {
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        modelParams: null,
        provider: 'openai',
      }),
    ).toBeNull();
  });

  it("falls back to the provider's own default for known keys when nothing was overridden", () => {
    // DeepSeek defaults thinking to enabled. Neither the client nor any
    // saved per-route config contributed a value, so the snapshot emits the
    // provider's natural default — that's what the request actually had.
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        modelParams: null,
        provider: 'deepseek',
      }),
    ).toEqual({ thinking: { type: 'enabled' } });
  });

  it("records the user's saved per-route override when present", () => {
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        modelParams: { thinking: { type: 'disabled' } },
        provider: 'deepseek',
      }),
    ).toEqual({ thinking: { type: 'disabled' } });
  });

  it("client body wins by presence over saved per-route params", () => {
    expect(
      snapshotRequestParams({
        body: { thinking: { type: 'enabled' }, messages: [] },
        modelParams: { thinking: { type: 'disabled' } },
        provider: 'deepseek',
      }),
    ).toEqual({ thinking: { type: 'enabled' } });
  });

  it('only emits keys from REQUEST_PARAM_KEYS — extraneous body fields stay out of the snapshot', () => {
    const result = snapshotRequestParams({
      body: { messages: [], temperature: 0.7, thinking: { type: 'enabled' } },
      modelParams: null,
      provider: 'deepseek',
    });
    expect(result).toEqual({ thinking: { type: 'enabled' } });
    expect(Object.keys(result!)).not.toContain('temperature');
    expect(Object.keys(result!)).not.toContain('messages');
  });
});
