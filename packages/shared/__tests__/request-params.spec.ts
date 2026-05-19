import { applyRequestParamDefaults } from '../src/request-params';
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

const budgetSpec: ProviderParamSpec = {
  key: 'budget_tokens',
  control: {
    kind: 'number',
    label: 'Budget tokens',
    min: 1024,
    default: 2048,
  },
  serialize: (v) => ({ thinking: { type: 'enabled', budget_tokens: v } }),
};

describe('applyRequestParamDefaults', () => {
  it('returns the body unchanged when defaults are null or undefined', () => {
    const body: Record<string, unknown> = { messages: [], stream: true };
    expect(applyRequestParamDefaults(body, null, [thinkingSpec])).toBe(body);
    expect(applyRequestParamDefaults(body, undefined, [thinkingSpec])).toBe(body);
  });

  it('injects configured defaults when the body has no value for that key', () => {
    const body: Record<string, unknown> = { messages: [] };
    const merged = applyRequestParamDefaults(body, { thinking: 'disabled' }, [thinkingSpec]);
    expect(merged.thinking).toEqual('disabled');
    expect(merged.messages).toEqual([]);
  });

  it('uses the spec serializer when a default needs a non-flat wire shape', () => {
    const body: Record<string, unknown> = { messages: [] };
    const merged = applyRequestParamDefaults(body, { budget_tokens: 4096 }, [budgetSpec]);
    expect(merged.thinking).toEqual({ type: 'enabled', budget_tokens: 4096 });
  });

  it('lets the request body win by presence — even when the value is null', () => {
    const body: Record<string, unknown> = { messages: [], thinking: null };
    const merged = applyRequestParamDefaults(body, { thinking: 'disabled' }, [thinkingSpec]);
    expect(merged.thinking).toBeNull();
  });

  it('lets the request body win when it sets a different value', () => {
    const body: Record<string, unknown> = { messages: [], thinking: 'enabled' };
    const merged = applyRequestParamDefaults(body, { thinking: 'disabled' }, [thinkingSpec]);
    expect(merged.thinking).toEqual('enabled');
  });

  it('lets a request body field override a serialized default fragment', () => {
    const body: Record<string, unknown> = {
      messages: [],
      thinking: { type: 'adaptive' },
    };
    const merged = applyRequestParamDefaults(body, { budget_tokens: 4096 }, [budgetSpec]);
    expect(merged.thinking).toEqual({ type: 'adaptive' });
  });

  it('ignores defaults with no matching spec entry', () => {
    const body: Record<string, unknown> = { messages: [] };
    const merged = applyRequestParamDefaults(body, { temperature: 0.7 }, [thinkingSpec]);
    expect(merged).toEqual({ messages: [] });
  });

  it('merges Anthropic API-key scalar defaults through resolved specs', () => {
    const body: Record<string, unknown> = { messages: [] };
    const specs: ProviderParamSpec[] = [
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
    ];
    const merged = applyRequestParamDefaults(
      body,
      { max_tokens: 2048, temperature: 0.4, top_p: 0.8, top_k: 40 },
      specs,
    );
    expect(merged).toEqual({
      max_tokens: 2048,
      temperature: 0.4,
      top_p: 0.8,
      top_k: 40,
      messages: [],
    });
  });

  it('does not mutate the inputs', () => {
    const body: Record<string, unknown> = { messages: [] };
    const defaults = { thinking: 'disabled' };
    const merged = applyRequestParamDefaults(body, defaults, [thinkingSpec]);
    expect(body).toEqual({ messages: [] });
    expect(defaults).toEqual({ thinking: 'disabled' });
    expect(merged).not.toBe(body);
  });
});
