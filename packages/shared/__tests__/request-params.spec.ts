import { applyRequestParamDefaults } from '../src/request-params';

describe('applyRequestParamDefaults', () => {
  it('returns the body unchanged when defaults are null or undefined', () => {
    const body: Record<string, unknown> = { messages: [], stream: true };
    expect(applyRequestParamDefaults(body, null)).toBe(body);
    expect(applyRequestParamDefaults(body, undefined)).toBe(body);
  });

  it('injects configured defaults when the body has no value for that key', () => {
    const body: Record<string, unknown> = { messages: [] };
    const merged = applyRequestParamDefaults(body, { thinking: { type: 'disabled' } });
    expect(merged.thinking).toEqual({ type: 'disabled' });
    expect(merged.messages).toEqual([]);
  });

  it('lets the request body win by presence — even when the value is null', () => {
    const body: Record<string, unknown> = { messages: [], thinking: null };
    const merged = applyRequestParamDefaults(body, { thinking: { type: 'disabled' } });
    expect(merged.thinking).toBeNull();
  });

  it('lets the request body win when it sets a different value', () => {
    const body: Record<string, unknown> = { messages: [], thinking: { type: 'enabled' } };
    const merged = applyRequestParamDefaults(body, { thinking: { type: 'disabled' } });
    expect(merged.thinking).toEqual({ type: 'enabled' });
  });

  it('does not mutate the inputs', () => {
    const body: Record<string, unknown> = { messages: [] };
    const defaults = { thinking: { type: 'disabled' as const } };
    const merged = applyRequestParamDefaults(body, defaults);
    expect(body).toEqual({ messages: [] });
    expect(defaults).toEqual({ thinking: { type: 'disabled' } });
    expect(merged).not.toBe(body);
  });
});
