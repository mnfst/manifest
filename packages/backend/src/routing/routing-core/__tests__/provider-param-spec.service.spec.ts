import { ProviderParamSpecService } from '../provider-param-spec.service';

describe('ProviderParamSpecService', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function mockRemoteCatalog(etag: string | null = '"v1"'): void {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name: string) => (name.toLowerCase() === 'etag' ? etag : null) },
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
    } as unknown as Response);
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

  it('refreshes specs from modelparams.dev and filters API-level params', async () => {
    mockRemoteCatalog();
    const service = new ProviderParamSpecService();

    await expect(service.refreshCache()).resolves.toBe(2);

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://modelparams.dev/api/v1/models.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const remoteSpecs = await service.getSpecs('openai', 'api_key', 'gpt-test');
    expect(remoteSpecs.map((spec) => spec.path)).toEqual(['max_completion_tokens', 'temperature']);
    expect(remoteSpecs.map((spec) => spec.path)).not.toContain('stream');
    await expect(service.list()).resolves.toHaveLength(2);
    expect(service.getLastFetchedAt()).toBeInstanceOf(Date);
  });

  it('lists model identities without param details', async () => {
    mockRemoteCatalog();
    const service = new ProviderParamSpecService();
    await service.refreshCache();

    expect(service.listModelIds()).toEqual([
      { provider: 'anthropic', authType: 'api_key', model: 'claude-sonnet-4-6' },
      { provider: 'openai', authType: 'api_key', model: 'gpt-test' },
    ]);
  });

  it('sends If-None-Match and keeps the cache on a 304 response', async () => {
    mockRemoteCatalog('"v1"');
    const service = new ProviderParamSpecService();
    await service.refreshCache();

    fetchSpy.mockResolvedValue({ status: 304, ok: false } as Response);

    // 304 returns the cached count without re-parsing, and the conditional
    // request carries the previously captured ETag.
    await expect(service.refreshCache()).resolves.toBe(2);
    await expect(service.list()).resolves.toHaveLength(2);
    expect(fetchSpy).toHaveBeenLastCalledWith(
      'https://modelparams.dev/api/v1/models.json',
      expect.objectContaining({ headers: { 'If-None-Match': '"v1"' } }),
    );
  });

  it('does not set a conditional header when the response has no ETag', async () => {
    mockRemoteCatalog(null);
    const service = new ProviderParamSpecService();
    await service.refreshCache();
    await service.refreshCache();

    expect(fetchSpy).toHaveBeenLastCalledWith(
      'https://modelparams.dev/api/v1/models.json',
      expect.objectContaining({ headers: {} }),
    );
  });

  it('keeps the previous ETag when a 200 response has an invalid body', async () => {
    mockRemoteCatalog('"v1"');
    const service = new ProviderParamSpecService();
    await service.refreshCache(); // adopts "v1"

    // 200 with a NEW ETag but an unparseable catalog — the new tag must not be
    // committed, or a later 304 under it would strand us on the stale cache.
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => '"v2-bad"' },
      json: async () => ({ models: 'not-an-array' }),
    } as unknown as Response);
    await service.refreshCache(); // invalid → keep cache and keep "v1"

    // The next conditional request still carries "v1", proving "v2-bad" was
    // never adopted.
    mockRemoteCatalog('"v3"');
    await service.refreshCache();
    expect(fetchSpy).toHaveBeenLastCalledWith(
      'https://modelparams.dev/api/v1/models.json',
      expect.objectContaining({ headers: { 'If-None-Match': '"v1"' } }),
    );
  });

  it('stays empty when the initial remote fetch fails', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 503 } as Response);
    const service = new ProviderParamSpecService();

    await expect(service.refreshCache()).resolves.toBe(0);
    await expect(service.list()).resolves.toEqual([]);
    expect(service.getLastFetchedAt()).toBeNull();
  });

  it('swallows network errors and keeps the cache empty', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    const service = new ProviderParamSpecService();

    await expect(service.refreshCache()).resolves.toBe(0);
    await expect(service.list()).resolves.toEqual([]);
  });

  it('onModuleInit swallows a refresh failure', async () => {
    const service = new ProviderParamSpecService();
    // refreshCache swallows fetch errors itself, so force it to reject to
    // exercise onModuleInit's defensive catch.
    jest.spyOn(service, 'refreshCache').mockRejectedValue(new Error('boom'));

    await expect(service.onModuleInit()).resolves.toBeUndefined();
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
      status: 200,
      headers: { get: () => null },
      json: async () => ({ models: [{ provider: 'openai', authType: 'api_key' }] }),
    } as unknown as Response);

    await expect(service.refreshCache()).resolves.toBe(0);
    await expect(service.list()).resolves.toHaveLength(2);
  });
});
