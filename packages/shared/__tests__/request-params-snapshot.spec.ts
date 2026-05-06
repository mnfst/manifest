import { snapshotRequestParams } from '../src/request-params-snapshot';

describe('snapshotRequestParams', () => {
  it('returns null when the provider has no known param keys (e.g. OpenAI)', () => {
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        userDefaults: null,
        tier: 'reasoning',
        isSpecificity: false,
        provider: 'openai',
      }),
    ).toBeNull();
  });

  it("falls back to the provider's own default for known keys when nothing was overridden", () => {
    // DeepSeek defaults thinking to enabled; the reasoning tier intentionally
    // stays neutral, so neither user nor Manifest contributed a value. The
    // snapshot still emits the effective state so dashboards can show what
    // the request actually had.
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        userDefaults: null,
        tier: 'reasoning',
        isSpecificity: false,
        provider: 'deepseek',
      }),
    ).toEqual({ thinking: { type: 'enabled' } });
  });

  it("captures Manifest's tier-aware default for DeepSeek on standard tier", () => {
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        userDefaults: null,
        tier: 'standard',
        isSpecificity: false,
        provider: 'deepseek',
      }),
    ).toEqual({ thinking: { type: 'disabled' } });
  });

  it("skips Manifest's tier-aware default for specificity matches but still records the provider's own effective default", () => {
    // Manifest deliberately stays out of the way on specificity slots.
    // The provider-default fallback still records `enabled` because that
    // is what DeepSeek will actually do without an explicit `thinking`
    // field — the dashboard would otherwise show no params at all and the
    // operator couldn't tell why a specificity-routed request burned
    // budget on reasoning tokens.
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        userDefaults: null,
        tier: 'standard',
        isSpecificity: true,
        provider: 'deepseek',
      }),
    ).toEqual({ thinking: { type: 'enabled' } });
  });

  it("client body wins by presence over both user defaults and Manifest's", () => {
    expect(
      snapshotRequestParams({
        body: { thinking: { type: 'enabled' }, messages: [] },
        userDefaults: { thinking: { type: 'disabled' } },
        tier: 'standard',
        isSpecificity: false,
        provider: 'deepseek',
      }),
    ).toEqual({ thinking: { type: 'enabled' } });
  });

  it('user defaults win over Manifest defaults when client body has no known key', () => {
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        userDefaults: { thinking: { type: 'enabled' } },
        tier: 'standard',
        isSpecificity: false,
        provider: 'deepseek',
      }),
    ).toEqual({ thinking: { type: 'enabled' } });
  });

  it('drops user defaults that the resolved provider does not consume', () => {
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        userDefaults: { thinking: { type: 'disabled' } },
        tier: 'standard',
        isSpecificity: false,
        // Anthropic does not consume the OpenAI-compat `thinking.type` field;
        // a DeepSeek-shaped knob must not leak onto an Anthropic fallback.
        provider: 'anthropic',
      }),
    ).toBeNull();
  });

  it('only emits keys from REQUEST_PARAM_KEYS — extraneous body fields stay out of the snapshot', () => {
    const result = snapshotRequestParams({
      body: { messages: [], temperature: 0.7, thinking: { type: 'enabled' } },
      userDefaults: null,
      tier: 'standard',
      isSpecificity: false,
      provider: 'deepseek',
    });
    expect(result).toEqual({ thinking: { type: 'enabled' } });
    expect(Object.keys(result!)).not.toContain('temperature');
    expect(Object.keys(result!)).not.toContain('messages');
  });
});
