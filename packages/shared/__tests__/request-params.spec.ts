import { applyRequestParamDefaults } from '../src/request-params';
import type { ProviderParamSpec } from '../src/provider-params-spec';

const specs: readonly ProviderParamSpec[] = [
  {
    provider: 'anthropic',
    authType: 'api_key',
    model: 'claude-sonnet-4-6',
    path: 'thinking.budget_tokens',
    type: 'integer',
    label: 'Thinking budget',
    default: 4096,
    range: { min: 1024, max: 32768, step: 1024 },
    group: 'reasoning',
    applicability: { only: { 'thinking.type': 'enabled' } },
  },
  {
    provider: 'anthropic',
    authType: 'api_key',
    model: 'claude-sonnet-4-6',
    path: 'thinking.type',
    type: 'enum',
    label: 'Thinking mode',
    default: 'disabled',
    values: ['disabled', 'adaptive', 'enabled'],
    group: 'reasoning',
  },
  {
    provider: 'anthropic',
    authType: 'api_key',
    model: 'claude-sonnet-4-6',
    path: 'temperature',
    type: 'number',
    label: 'Temperature',
    default: 1,
    range: { min: 0, max: 1, step: 0.1 },
    group: 'sampling',
    applicability: { except: { 'thinking.type': ['enabled', 'adaptive'] } },
  },
  {
    provider: 'anthropic',
    authType: 'api_key',
    model: 'claude-sonnet-4-6',
    path: 'top_p',
    type: 'number',
    label: 'Top P',
    default: 1,
    range: { min: 0, max: 1, step: 0.01 },
    group: 'sampling',
    applicability: {
      except: [{ 'thinking.type': ['enabled', 'adaptive'] }, { temperature: { not: 1 } }],
    },
  },
];

describe('applyRequestParamDefaults', () => {
  it('returns the body unchanged when defaults are null or undefined', () => {
    const body: Record<string, unknown> = { messages: [], stream: true };
    expect(applyRequestParamDefaults(body, null, specs)).toBe(body);
    expect(applyRequestParamDefaults(body, undefined, specs)).toBe(body);
  });

  it('injects flat configured defaults when the body has no value', () => {
    const body: Record<string, unknown> = { messages: [] };
    const merged = applyRequestParamDefaults(body, { temperature: 0.2 }, specs);
    expect(merged).toEqual({ messages: [], temperature: 0.2 });
  });

  it('injects nested defaults and fills applicable nested siblings', () => {
    const body: Record<string, unknown> = { messages: [] };
    const merged = applyRequestParamDefaults(body, { thinking: { type: 'enabled' } }, specs);
    expect(merged).toEqual({
      messages: [],
      thinking: { type: 'enabled', budget_tokens: 4096 },
    });
  });

  it('lets the request body win by presence, including nested values', () => {
    const body: Record<string, unknown> = {
      messages: [],
      thinking: { budget_tokens: 8192 },
    };
    const merged = applyRequestParamDefaults(body, { thinking: { type: 'enabled' } }, specs);
    expect(merged.thinking).toEqual({ type: 'enabled', budget_tokens: 8192 });
  });

  it('omits defaults that are unavailable under selected values', () => {
    const body: Record<string, unknown> = { messages: [] };
    const merged = applyRequestParamDefaults(
      body,
      { temperature: 0.2, thinking: { type: 'enabled' } },
      specs,
    );
    expect(merged).toEqual({
      messages: [],
      thinking: { type: 'enabled', budget_tokens: 4096 },
    });
  });

  it('omits defaults that conflict with configured non-default values', () => {
    const body: Record<string, unknown> = { messages: [] };
    const merged = applyRequestParamDefaults(body, { temperature: 0.2, top_p: 0.7 }, specs);
    expect(merged).toEqual({ messages: [], temperature: 0.2 });
  });

  it('does not mutate the inputs', () => {
    const body: Record<string, unknown> = { messages: [] };
    const defaults = { thinking: { type: 'enabled' as const } };
    const merged = applyRequestParamDefaults(body, defaults, specs);
    expect(body).toEqual({ messages: [] });
    expect(defaults).toEqual({ thinking: { type: 'enabled' } });
    expect(merged).not.toBe(body);
  });
});
