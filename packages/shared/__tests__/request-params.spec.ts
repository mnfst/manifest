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
    description: 'Maximum Anthropic extended thinking token budget.',
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
    description: 'Controls Anthropic thinking mode.',
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
    description: 'Controls sampling randomness.',
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
    description: 'Controls nucleus sampling.',
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

  it('lets configured Manifest params win over request body values at the same path', () => {
    const body: Record<string, unknown> = {
      messages: [],
      temperature: 0.4,
    };
    const merged = applyRequestParamDefaults(body, { temperature: 0.8 }, specs);
    expect(merged).toEqual({ messages: [], temperature: 0.8 });
  });

  it('keeps request body params that are not configured in Manifest', () => {
    const body: Record<string, unknown> = {
      messages: [],
      temperature: 0.4,
      max_tokens: 2048,
    };
    const merged = applyRequestParamDefaults(body, { thinking: { type: 'disabled' } }, specs);
    expect(merged).toEqual({
      messages: [],
      temperature: 0.4,
      max_tokens: 2048,
      thinking: { type: 'disabled' },
    });
  });

  it('lets configured nested Manifest params win while preserving unconfigured nested siblings', () => {
    const body: Record<string, unknown> = {
      messages: [],
      thinking: { type: 'enabled', vendor_note: 'client-only' },
    };
    const merged = applyRequestParamDefaults(body, { thinking: { type: 'disabled' } }, specs);
    expect(merged.thinking).toEqual({ type: 'disabled', vendor_note: 'client-only' });
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

  describe('stale catalog siblings (#2543)', () => {
    // claude-opus-4-8-shaped spec: `adaptive`-only thinking, NO budget_tokens
    // param at all — so the applicability scrub has nothing to judge a caller
    // `thinking.budget_tokens` against.
    const adaptiveOnlySpecs: readonly ProviderParamSpec[] = [
      {
        provider: 'anthropic',
        authType: 'subscription',
        model: 'claude-opus-4-8',
        path: 'thinking.type',
        type: 'enum',
        label: 'Thinking mode',
        description: 'Controls Anthropic thinking mode.',
        default: 'disabled',
        values: ['disabled', 'adaptive'],
        group: 'reasoning',
      },
      {
        provider: 'anthropic',
        authType: 'subscription',
        model: 'claude-opus-4-8',
        path: 'thinking.display',
        type: 'enum',
        label: 'Thinking display',
        description: 'Controls how thinking is surfaced.',
        default: 'omitted',
        values: ['summarized', 'omitted'],
        group: 'reasoning',
        applicability: { only: { 'thinking.type': ['adaptive'] } },
      },
    ];
    const knownParamPaths = new Set(['thinking.type', 'thinking.display', 'thinking.budget_tokens']);
    // Claude Code /v1/messages body with extended thinking on.
    const clientBody = () => ({
      messages: [],
      thinking: { type: 'enabled', budget_tokens: 8192 },
    });

    it('drops a caller param the catalog knows but the spec omits when the merge rewrites its root', () => {
      const merged = applyRequestParamDefaults(
        clientBody(),
        { thinking: { type: 'adaptive', display: 'omitted' } },
        adaptiveOnlySpecs,
        knownParamPaths,
      );
      expect(merged.thinking).toEqual({ type: 'adaptive', display: 'omitted' });
    });

    it('keeps caller params when the merge does not change any value under the root', () => {
      const body = { messages: [], thinking: { type: 'adaptive', budget_tokens: 8192 } };
      const merged = applyRequestParamDefaults(
        body,
        { thinking: { type: 'adaptive' } },
        adaptiveOnlySpecs,
        knownParamPaths,
      );
      expect((merged.thinking as Record<string, unknown>).budget_tokens).toBe(8192);
    });

    it('keeps unknown vendor extensions even when the merge rewrites the root', () => {
      const body = {
        messages: [],
        thinking: { type: 'enabled', budget_tokens: 8192, vendor_note: 'client-only' },
      };
      const merged = applyRequestParamDefaults(
        body,
        { thinking: { type: 'adaptive' } },
        adaptiveOnlySpecs,
        knownParamPaths,
      );
      expect(merged.thinking).toEqual({
        type: 'adaptive',
        display: 'omitted',
        vendor_note: 'client-only',
      });
    });

    it('keeps caller params at paths the current spec still defines', () => {
      // `thinking.effort` is spec-defined (no default, so the merge never
      // writes it): the applicability machinery owns spec'd paths, so the
      // stale-sibling drop must leave it alone even under a rewritten root.
      const specsWithEffort: readonly ProviderParamSpec[] = [
        ...adaptiveOnlySpecs,
        {
          provider: 'anthropic',
          authType: 'subscription',
          model: 'claude-opus-4-8',
          path: 'thinking.effort',
          type: 'enum',
          label: 'Thinking effort',
          description: 'Controls thinking effort.',
          values: ['low', 'high'],
          group: 'reasoning',
        },
      ];
      const body = {
        messages: [],
        thinking: { type: 'enabled', effort: 'high', budget_tokens: 8192 },
      };
      const merged = applyRequestParamDefaults(
        body,
        { thinking: { type: 'adaptive' } },
        specsWithEffort,
        new Set([...knownParamPaths, 'thinking.effort']),
      );
      expect(merged.thinking).toEqual({ type: 'adaptive', display: 'omitted', effort: 'high' });
    });

    it('ignores roots the body does not carry and non-record merged roots', () => {
      const specsWithMaxTokens: readonly ProviderParamSpec[] = [
        ...adaptiveOnlySpecs,
        {
          provider: 'anthropic',
          authType: 'subscription',
          model: 'claude-opus-4-8',
          path: 'max_tokens',
          type: 'integer',
          label: 'Max tokens',
          description: 'Maximum output tokens.',
          default: 4096,
          range: { min: 1 },
          group: 'generation_length',
        },
      ];
      const merged = applyRequestParamDefaults(
        { messages: [], max_tokens: 2048 },
        { max_tokens: 1024, thinking: { type: 'adaptive' } },
        specsWithMaxTokens,
        knownParamPaths,
      );
      expect(merged).toEqual({
        messages: [],
        max_tokens: 1024,
        thinking: { type: 'adaptive', display: 'omitted' },
      });
    });

    it('scrubs nothing without the catalog path set', () => {
      const merged = applyRequestParamDefaults(
        clientBody(),
        { thinking: { type: 'adaptive', display: 'omitted' } },
        adaptiveOnlySpecs,
      );
      expect((merged.thinking as Record<string, unknown>).budget_tokens).toBe(8192);
    });

    it('tolerates a stale path whose parent the merge replaced with a scalar', () => {
      const specsWithScalarDeep: readonly ProviderParamSpec[] = [
        ...adaptiveOnlySpecs,
        {
          provider: 'anthropic',
          authType: 'subscription',
          model: 'claude-opus-4-8',
          path: 'thinking.deep',
          type: 'string',
          label: 'Deep mode',
          description: 'Scalar param whose path shadows a caller record.',
          group: 'reasoning',
        },
      ];
      const body = {
        messages: [],
        thinking: { type: 'enabled', deep: { budget_tokens: 5 } },
      };
      const merged = applyRequestParamDefaults(
        body,
        { thinking: { type: 'adaptive', deep: 'off' } },
        specsWithScalarDeep,
        new Set([...knownParamPaths, 'thinking.deep.budget_tokens']),
      );
      expect(merged.thinking).toEqual({ type: 'adaptive', display: 'omitted', deep: 'off' });
    });

    it('survives a nested caller record replaced wholesale by the merge', () => {
      const body = {
        messages: [],
        thinking: { type: 'enabled', budget_tokens: { nested: true } },
      };
      const merged = applyRequestParamDefaults(
        body,
        { thinking: { type: 'adaptive' } },
        adaptiveOnlySpecs,
        knownParamPaths,
      );
      // The record-valued budget_tokens yields leaf `thinking.budget_tokens.nested`,
      // which the catalog does not know — preserved as an unknown extension.
      expect(merged.thinking).toEqual({
        type: 'adaptive',
        display: 'omitted',
        budget_tokens: { nested: true },
      });
    });
  });
});
