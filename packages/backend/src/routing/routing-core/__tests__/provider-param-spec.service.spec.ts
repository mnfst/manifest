import { ProviderParamSpecService } from '../provider-param-spec.service';

describe('ProviderParamSpecService', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function mockRemoteCatalog(): void {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          {
            provider: 'anthropic',
            authType: 'api_key',
            model: 'claude-sonnet-4-6',
            params: [
              {
                path: 'thinking.type',
                type: 'enum',
                label: 'Thinking mode',
                description: 'Controls Anthropic thinking mode.',
                group: 'reasoning',
                default: 'disabled',
                values: ['disabled', 'adaptive', 'enabled'],
              },
            ],
          },
          {
            provider: 'openai',
            authType: 'api_key',
            model: 'gpt-test',
            params: [
              {
                path: 'stream',
                type: 'boolean',
                label: 'Stream',
                description: 'API-level streaming flag.',
                group: 'output_format',
                default: false,
              },
              {
                path: 'temperature',
                type: 'number',
                label: 'Temperature',
                description: 'Controls randomness.',
                group: 'sampling',
                default: 1,
                range: { min: 0, max: 2, step: 0.1 },
              },
              {
                path: 'max_completion_tokens',
                type: 'integer',
                label: 'Max completion tokens',
                description: 'Upper bound on generated tokens.',
                group: 'generation_length',
                range: { min: 1 },
              },
            ],
          },
        ],
      }),
    } as Response);
  }

  it('starts empty before the remote catalog loads', async () => {
    const service = new ProviderParamSpecService();

    await expect(service.list()).resolves.toEqual([]);
  });

  it('filters specs by provider, auth type, and model', async () => {
    mockRemoteCatalog();
    const service = new ProviderParamSpecService();
    await service.refreshCache();

    const apiSpecs = await service.getSpecs('anthropic', 'api_key', 'claude-sonnet-4-6');
    const subscriptionSpecs = await service.getSpecs(
      'anthropic',
      'subscription',
      'claude-sonnet-4-6',
    );

    expect(apiSpecs.map((spec) => spec.path)).toContain('thinking.type');
    expect(subscriptionSpecs.map((spec) => spec.path)).toEqual([]);
  });

  it('refreshes specs from modelparameters.dev and filters API-level params', async () => {
    mockRemoteCatalog();
    const service = new ProviderParamSpecService();

    await expect(service.refreshCache()).resolves.toBe(2);

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://modelparameters.dev/api/v1/models.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const remoteSpecs = await service.getSpecs('openai', 'api_key', 'gpt-test');
    expect(remoteSpecs.map((spec) => spec.path)).toEqual(['max_completion_tokens', 'temperature']);
    expect(remoteSpecs.map((spec) => spec.path)).not.toContain('stream');
    await expect(service.list()).resolves.toHaveLength(2);
    expect(service.getLastFetchedAt()).toBeInstanceOf(Date);
  });

  it('stays empty when the initial remote fetch fails', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 503 } as Response);
    const service = new ProviderParamSpecService();

    await expect(service.refreshCache()).resolves.toBe(0);
    await expect(service.list()).resolves.toEqual([]);
    expect(service.getLastFetchedAt()).toBeNull();
  });

  it('keeps the current cache when a later remote fetch fails', async () => {
    mockRemoteCatalog();
    const service = new ProviderParamSpecService();
    await service.refreshCache();

    fetchSpy.mockResolvedValue({ ok: false, status: 503 } as Response);

    await expect(service.refreshCache()).resolves.toBe(0);
    await expect(service.list()).resolves.toHaveLength(2);
    expect(service.getLastFetchedAt()).toBeInstanceOf(Date);
  });

  it('keeps the current cache when the remote catalog shape is invalid', async () => {
    mockRemoteCatalog();
    const service = new ProviderParamSpecService();
    await service.refreshCache();

    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ provider: 'openai', authType: 'api_key' }] }),
    } as Response);

    await expect(service.refreshCache()).resolves.toBe(0);
    await expect(service.list()).resolves.toHaveLength(2);
  });

  describe('onModuleInit', () => {
    it('kicks off refreshCache without blocking and loads the catalog', async () => {
      mockRemoteCatalog();
      const service = new ProviderParamSpecService();
      const refresh = jest.spyOn(service, 'refreshCache');

      // Fire-and-forget (must not block boot — see #1894); await the kicked-off
      // refresh deterministically via the spy's returned promise.
      service.onModuleInit();
      await refresh.mock.results[0].value;

      await expect(service.list()).resolves.toHaveLength(2);
    });

    it('does not leave an unhandled rejection when the startup refresh rejects', async () => {
      const service = new ProviderParamSpecService();
      const refresh = jest.spyOn(service, 'refreshCache').mockRejectedValue(new Error('boom'));

      service.onModuleInit();
      // onModuleInit attaches a .catch that swallows the failure.
      await expect(refresh.mock.results[0].value).rejects.toThrow('boom');
    });
  });
});
