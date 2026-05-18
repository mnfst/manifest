import { snapshotRequestParams } from '../src/request-params-snapshot';

describe('snapshotRequestParams', () => {
  it('returns null when the provider has no known param keys (e.g. OpenAI)', () => {
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        modelParams: null,
        provider: 'openai',
        authType: 'api_key',
        model: 'gpt-4o',
      }),
    ).toBeNull();
  });

  it('returns null when the provider supports params under a different auth type', () => {
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        modelParams: null,
        provider: 'deepseek',
        authType: 'subscription',
        model: 'deepseek-v4',
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
        authType: 'api_key',
        model: 'deepseek-v4',
      }),
    ).toEqual({ thinking: 'enabled' });
  });

  it("records the user's saved per-route override when present", () => {
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        modelParams: { thinking: 'disabled' },
        provider: 'deepseek',
        authType: 'api_key',
        model: 'deepseek-v4',
      }),
    ).toEqual({ thinking: 'disabled' });
  });

  it("client body wins by presence over saved per-route params", () => {
    expect(
      snapshotRequestParams({
        body: { thinking: 'enabled', messages: [] },
        modelParams: { thinking: 'disabled' },
        provider: 'deepseek',
        authType: 'api_key',
        model: 'deepseek-v4',
      }),
    ).toEqual({ thinking: 'enabled' });
  });

  it('only emits keys from the route specs — extraneous body fields stay out of the snapshot', () => {
    const result = snapshotRequestParams({
      body: { messages: [], temperature: 0.7, thinking: 'enabled' },
      modelParams: null,
      provider: 'deepseek',
      authType: 'api_key',
      model: 'deepseek-v4',
    });
    expect(result).toEqual({ thinking: 'enabled' });
    expect(Object.keys(result!)).not.toContain('temperature');
    expect(Object.keys(result!)).not.toContain('messages');
  });
});
