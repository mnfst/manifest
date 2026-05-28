import { snapshotRequestParams } from '../src/request-params-snapshot';
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

describe('snapshotRequestParams', () => {
  it('returns null when the resolved model has no specs', () => {
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        modelParams: null,
        specs: [],
      }),
    ).toBeNull();
  });

  it('falls back to provider defaults for known params', () => {
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        modelParams: null,
        specs,
      }),
    ).toEqual({ temperature: 1, top_p: 1, thinking: { type: 'disabled' } });
  });

  it('records saved per-route params and nested sibling defaults', () => {
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        modelParams: { thinking: { type: 'enabled' } },
        specs,
      }),
    ).toEqual({ thinking: { type: 'enabled', budget_tokens: 4096 } });
  });

  it('records saved Manifest params over client body values at the same path', () => {
    expect(
      snapshotRequestParams({
        body: { temperature: 0.4, messages: [] },
        modelParams: { temperature: 0.8 },
        specs,
      }),
    ).toEqual({ temperature: 0.8, thinking: { type: 'disabled' } });
  });

  it('records client body params that are not configured in Manifest', () => {
    expect(
      snapshotRequestParams({
        body: { temperature: 0.4, messages: [] },
        modelParams: { thinking: { type: 'disabled' } },
        specs,
      }),
    ).toEqual({ temperature: 0.4, thinking: { type: 'disabled' } });
  });

  it('omits unavailable params from the snapshot', () => {
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        modelParams: { temperature: 0.7, thinking: { type: 'adaptive' } },
        specs,
      }),
    ).toEqual({ thinking: { type: 'adaptive' } });
  });

  it('omits conflicted defaults from the snapshot', () => {
    expect(
      snapshotRequestParams({
        body: { messages: [] },
        modelParams: { temperature: 0.2, top_p: 0.7 },
        specs,
      }),
    ).toEqual({ temperature: 0.2, thinking: { type: 'disabled' } });
  });
});
