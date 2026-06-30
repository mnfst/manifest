import type { DiscoveredModel } from '../../../model-discovery/model-fetcher';
import { openAiModelId, routeForOpenAiModelId } from '../openai-model-id';

function model(overrides: Partial<DiscoveredModel> = {}): DiscoveredModel {
  return {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128000,
    inputPricePerToken: null,
    outputPricePerToken: null,
    capabilityReasoning: false,
    capabilityCode: false,
    qualityScore: 4,
    authType: 'api_key',
    ...overrides,
  };
}

describe('OpenAI model ids', () => {
  it('formats provider-qualified API-key model ids', () => {
    expect(openAiModelId(model({ id: 'gpt-4o-mini', provider: 'openai' }))).toBe(
      'openai/gpt-4o-mini',
    );
  });

  it('adds the subscription suffix for subscription routes', () => {
    expect(openAiModelId(model({ id: 'gpt-5.5', authType: 'subscription' }))).toBe(
      'openai/gpt-5.5-subscription',
    );
    expect(openAiModelId(model({ id: 'gpt-5.5-subscription', authType: 'subscription' }))).toBe(
      'openai/gpt-5.5-subscription',
    );
  });

  it('preserves provider-prefixed provider-native model ids', () => {
    expect(
      openAiModelId(
        model({
          id: 'opencode-go/glm-5.1',
          provider: 'opencode-go',
          authType: 'subscription',
        }),
      ),
    ).toBe('opencode-go/glm-5.1-subscription');
  });

  it('leaves custom model ids unchanged', () => {
    expect(
      openAiModelId(
        model({
          id: 'custom:provider-1/model-a',
          provider: 'custom:provider-1',
        }),
      ),
    ).toBe('custom:provider-1/model-a');
  });

  it('resolves listed ids back to routable provider/auth/model triples', () => {
    const route = routeForOpenAiModelId('openrouter/anthropic/claude-sonnet-4.5', [
      model({
        id: 'anthropic/claude-sonnet-4.5',
        provider: 'openrouter',
        authType: 'api_key',
      }),
    ]);

    expect(route).toEqual({
      provider: 'openrouter',
      authType: 'api_key',
      model: 'anthropic/claude-sonnet-4.5',
    });
  });

  it('returns null for unlisted or auth-less ids', () => {
    expect(routeForOpenAiModelId('openai/gpt-4o', [])).toBeNull();
    expect(routeForOpenAiModelId('openai/gpt-4o', [model({ id: 'gpt-4o-mini' })])).toBeNull();
    expect(routeForOpenAiModelId('openai/gpt-4o', [model({ authType: undefined })])).toBeNull();
  });
});
