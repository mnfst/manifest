import { ProviderParamSpecService } from '../provider-param-spec.service';

describe('ProviderParamSpecService', () => {
  it('loads model parameter specs from the modelparams package without network fetches', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const service = new ProviderParamSpecService();

    await expect(service.list()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'openai',
          authType: 'api_key',
          model: 'gpt-4o',
        }),
      ]),
    );
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('filters specs by provider, auth type, and model', async () => {
    const service = new ProviderParamSpecService();

    const apiSpecs = await service.getSpecs('openai', 'api_key', 'gpt-4o');
    const localSpecs = await service.getSpecs('openai', 'local', 'gpt-4o');

    expect(apiSpecs.map((spec) => spec.path)).toEqual(['max_tokens', 'temperature', 'top_p']);
    expect(localSpecs.map((spec) => spec.path)).toEqual([]);
  });

  it('lists model identities without param details and canonicalizes provider aliases', async () => {
    const service = new ProviderParamSpecService();

    expect(await service.listModelIds()).toEqual(
      expect.arrayContaining([
        { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
        { provider: 'zai', authType: 'api_key', model: 'glm-4.6' },
      ]),
    );
  });

  it('loads providerless subscription specs for prefixed Copilot models', async () => {
    const service = new ProviderParamSpecService();

    const specs = await service.getSpecs('copilot', 'subscription', 'copilot/gpt-5.5');

    expect(specs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'copilot',
          authType: 'subscription',
          model: 'copilot/gpt-5.5',
          path: 'reasoning.effort',
        }),
        expect.objectContaining({
          provider: 'copilot',
          authType: 'subscription',
          model: 'copilot/gpt-5.5',
          path: 'text.verbosity',
        }),
      ]),
    );
  });

  it('accepts Copilot subscription route ids that already include the subscription suffix', async () => {
    const service = new ProviderParamSpecService();

    const specs = await service.getSpecs('copilot', 'subscription', 'copilot/gpt-5.5-subscription');

    expect(specs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'copilot',
          authType: 'subscription',
          model: 'copilot/gpt-5.5-subscription',
          path: 'reasoning.effort',
        }),
      ]),
    );
  });

  it('normalizes Copilot Claude dotted minor versions before providerless lookup', async () => {
    const service = new ProviderParamSpecService();

    const specs = await service.getSpecs('copilot', 'subscription', 'copilot/claude-sonnet-4.6');

    expect(specs.map((spec) => spec.path)).toEqual(
      expect.arrayContaining([
        'max_tokens',
        'output_config.effort',
        'thinking.budget_tokens',
        'thinking.type',
      ]),
    );
    expect(specs[0]).toEqual(
      expect.objectContaining({
        provider: 'copilot',
        authType: 'subscription',
        model: 'copilot/claude-sonnet-4.6',
      }),
    );
  });

  it('resolves Bedrock Claude model ids through the underlying Anthropic provider for params', async () => {
    const service = new ProviderParamSpecService();

    const specs = await service.getSpecs('bedrock', 'api_key', 'us.anthropic.claude-opus-4.8');

    expect(specs.map((spec) => spec.path)).toEqual(
      expect.arrayContaining(['max_tokens', 'output_config.effort', 'thinking.type']),
    );
    expect(specs[0]).toEqual(
      expect.objectContaining({
        provider: 'bedrock',
        authType: 'api_key',
        model: 'us.anthropic.claude-opus-4.8',
      }),
    );
  });

  it('strips dated Bedrock model ids for providerless params while preserving the route identity', async () => {
    const service = new ProviderParamSpecService();

    const specs = await service.getSpecs('bedrock', 'api_key', 'openai.gpt-5.4-2026-03-05');

    expect(specs.map((spec) => spec.path)).toEqual(['max_completion_tokens', 'reasoning_effort']);
    expect(specs[0]).toEqual(
      expect.objectContaining({
        provider: 'bedrock',
        authType: 'api_key',
        model: 'openai.gpt-5.4-2026-03-05',
      }),
    );
  });

  it('resolves the output-token field from ModelParams for custom OpenAI-compatible routes', async () => {
    const service = new ProviderParamSpecService();

    await expect(
      service.getOutputTokenParameter('custom:azure', 'api_key', 'gpt-5.4-mini'),
    ).resolves.toBe('max_completion_tokens');
    await expect(
      service.getOutputTokenParameter('custom:azure', 'api_key', 'o1-mini'),
    ).resolves.toBe('max_tokens');
  });

  it('falls back to package API-key specs for subscription routes without subscription specs', async () => {
    const service = new ProviderParamSpecService();

    const specs = await service.getSpecs('copilot', 'subscription', 'copilot/gpt-4o-mini');

    expect(specs.map((spec) => spec.path)).toEqual(['max_tokens', 'temperature', 'top_p']);
    expect(specs[0]).toEqual(
      expect.objectContaining({
        provider: 'copilot',
        authType: 'subscription',
        model: 'copilot/gpt-4o-mini',
      }),
    );
  });

  it('returns no specs for local or missing model routes', async () => {
    const service = new ProviderParamSpecService();

    await expect(service.getSpecs('openai', 'local', 'gpt-4o')).resolves.toEqual([]);
    await expect(service.getSpecs('openai', 'api_key', 'missing-model')).resolves.toEqual([]);
    await expect(service.getCapabilities('openai', 'api_key', 'missing-model')).resolves.toBeNull();
  });
});
