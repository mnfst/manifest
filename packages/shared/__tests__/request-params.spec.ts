import { applyRequestParamDefaults, type JsonValue } from '../src/request-params';
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
  group: {
    key: 'thinking',
    label: 'Thinking',
    serialize: (v): Record<string, JsonValue> => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
      const record = v as Record<string, unknown>;
      if (record.type !== 'enabled' || typeof record.budget_tokens !== 'number') return {};
      return { thinking: { type: 'enabled', budget_tokens: record.budget_tokens } };
    },
  },
  control: {
    kind: 'number',
    label: 'Budget tokens',
    min: 1024,
    default: 2048,
  },
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
    const merged = applyRequestParamDefaults(
      body,
      { thinking: { type: 'enabled', budget_tokens: 4096 } },
      [budgetSpec],
    );
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
    const merged = applyRequestParamDefaults(
      body,
      { thinking: { type: 'enabled', budget_tokens: 4096 } },
      [budgetSpec],
    );
    expect(merged.thinking).toEqual({ type: 'adaptive' });
  });

  it('serializes a grouped default only once when multiple specs share storage', () => {
    const body: Record<string, unknown> = { messages: [] };
    const typeSpec: ProviderParamSpec = {
      key: 'type',
      group: budgetSpec.group,
      control: {
        kind: 'select',
        label: 'Thinking mode',
        values: ['disabled', 'enabled'],
        default: 'disabled',
      },
    };

    const merged = applyRequestParamDefaults(
      body,
      { thinking: { type: 'enabled', budget_tokens: 4096 } },
      [typeSpec, budgetSpec],
    );

    expect(merged).toEqual({
      thinking: { type: 'enabled', budget_tokens: 4096 },
      messages: [],
    });
  });

  it('omits defaults that conflict with active provider dependencies', () => {
    const body: Record<string, unknown> = { messages: [] };
    const typeSpec: ProviderParamSpec = {
      key: 'type',
      group: {
        key: 'thinking',
        label: 'Thinking',
        serialize: (v): Record<string, JsonValue> => {
          if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
          const record = v as Record<string, unknown>;
          return record.type === 'adaptive' ? { thinking: { type: 'adaptive' } } : {};
        },
      },
      control: {
        kind: 'select',
        label: 'Thinking mode',
        values: ['disabled', 'adaptive', 'enabled'],
        default: 'disabled',
      },
    };
    const topKSpec: ProviderParamSpec = {
      key: 'top_k',
      control: { kind: 'number', label: 'Top K', min: 0, default: 0 },
      dependencies: [
        {
          effect: 'omit',
          when: { key: 'thinking.type', values: ['adaptive', 'enabled'] },
        },
      ],
    };
    const topPSpec: ProviderParamSpec = {
      key: 'top_p',
      control: { kind: 'slider', label: 'Top P', min: 0, max: 1, step: 0.01, default: 1 },
      dependencies: [
        {
          effect: 'omit',
          when: { key: 'thinking.type', values: ['adaptive', 'enabled'] },
        },
      ],
    };

    const merged = applyRequestParamDefaults(
      body,
      { top_k: 3, top_p: 0.4, thinking: { type: 'adaptive' } },
      [topKSpec, topPSpec, typeSpec],
    );

    expect(merged).toEqual({
      thinking: { type: 'adaptive' },
      messages: [],
    });
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
