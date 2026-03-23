import { ProviderModelFetcherService, PROVIDER_CONFIGS } from './provider-model-fetcher.service';

describe('ProviderModelFetcherService', () => {
  let service: ProviderModelFetcherService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new ProviderModelFetcherService();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  /* ── PROVIDER_CONFIGS sanity ── */

  it('should have configs for all providers including subscription variants', () => {
    const expected = [
      'openai',
      'openai-subscription',
      'deepseek',
      'mistral',
      'moonshot',
      'xai',
      'minimax',
      'minimax-subscription',
      'qwen',
      'ollama-cloud',
      'opencode',
      'opencode-go',
      'zai',
      'zai-subscription',
      'anthropic',
      'gemini',
      'openrouter',
      'ollama',
    ];
    for (const id of expected) {
      expect(PROVIDER_CONFIGS[id]).toBeDefined();
    }
  });

  /* ── Unknown provider ── */

  it('should return [] for unknown provider', async () => {
    const result = await service.fetch('nonexistent', 'key123');
    expect(result).toEqual([]);
  });

  /* ── Network error ── */

  it('should return [] on network error', async () => {
    fetchSpy.mockRejectedValue(new Error('network failure'));
    const result = await service.fetch('openai', 'key123');
    expect(result).toEqual([]);
  });

  it('should return [] on non-Error throw', async () => {
    fetchSpy.mockRejectedValue('string error');
    const result = await service.fetch('openai', 'key123');
    expect(result).toEqual([]);
  });

  /* ── Non-OK response ── */

  it('should return [] when response is not ok', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 401 });
    const result = await service.fetch('openai', 'key123');
    expect(result).toEqual([]);
  });

  /* ── Timeout handling ── */

  it('should abort on timeout', async () => {
    fetchSpy.mockImplementation(
      (_url: string, opts: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );

    jest.useFakeTimers();
    const promise = service.fetch('openai', 'key123');
    jest.advanceTimersByTime(6000);
    const result = await promise;
    expect(result).toEqual([]);
    jest.useRealTimers();
  });

  /* ── OpenAI parser (used by openai, deepseek, mistral, etc.) ── */

  describe('parseOpenAI (via openai provider)', () => {
    it('should parse valid OpenAI response', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'gpt-4o', object: 'model', owned_by: 'openai' },
            { id: 'gpt-3.5-turbo', object: 'model' },
          ],
        }),
      });

      const result = await service.fetch('openai', 'sk-test');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'gpt-4o',
          displayName: 'gpt-4o',
          provider: 'openai',
          contextWindow: 128000,
          inputPricePerToken: null,
          outputPricePerToken: null,
          qualityScore: 3,
        }),
      );
    });

    it('should filter out entries without string id', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: '', object: 'model' },
            { id: 123, object: 'model' },
            { object: 'model' },
            { id: 'valid-model' },
          ],
        }),
      });

      const result = await service.fetch('openai', 'sk-test');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('valid-model');
    });

    it('should return [] when data is not an array', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'not-array' }),
      });

      const result = await service.fetch('openai', 'sk-test');
      expect(result).toEqual([]);
    });

    it('should return [] when data is missing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const result = await service.fetch('openai', 'sk-test');
      expect(result).toEqual([]);
    });
  });

  /* ── OpenAI-compatible providers use same parser ── */

  it('should work for deepseek provider', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'deepseek-chat' }] }),
    });

    const result = await service.fetch('deepseek', 'key');
    expect(result).toHaveLength(1);
    expect(result[0].provider).toBe('deepseek');
  });

  it('should work for opencode-go provider', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'glm-5' }] }),
    });

    const result = await service.fetch('opencode-go', 'key');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'glm-5',
        provider: 'opencode-go',
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://opencode.ai/zen/v1/models',
      expect.objectContaining({
        headers: { Authorization: 'Bearer key' },
      }),
    );
  });

  /* ── Bearer auth header ── */

  it('should send bearer auth header for openai', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await service.fetch('openai', 'sk-abc');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.objectContaining({
        headers: { Authorization: 'Bearer sk-abc' },
      }),
    );
  });

  it('should use the endpoint override for MiniMax subscription discovery', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await service.fetch('minimax', 'sk-test', 'subscription', 'https://api.minimaxi.com/anthropic');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.minimaxi.com/anthropic/v1/models?limit=100',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer sk-test',
          'anthropic-version': '2023-06-01',
        },
      }),
    );
  });

  it('should ignore invalid endpoint overrides for MiniMax subscription discovery', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await service.fetch('minimax', 'sk-test', 'subscription', 'http://127.0.0.1:8080/anthropic');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.minimax.io/anthropic/v1/models?limit=100',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer sk-test',
          'anthropic-version': '2023-06-01',
        },
      }),
    );
  });

  /* ── Anthropic provider ── */

  describe('parseAnthropic (via anthropic provider)', () => {
    it('should parse valid Anthropic response', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'claude-3-opus', display_name: 'Claude 3 Opus', type: 'model' },
            { id: 'claude-3-sonnet', type: 'model' },
          ],
        }),
      });

      const result = await service.fetch('anthropic', 'sk-ant-test');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'claude-3-opus',
          displayName: 'Claude 3 Opus',
          provider: 'anthropic',
          contextWindow: 200000,
        }),
      );
      expect(result[1].displayName).toBe('claude-3-sonnet');
    });

    it('should filter out entries without type=model', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'claude-3-opus', type: 'model' },
            { id: 'not-a-model', type: 'other' },
            { id: 'no-type' },
          ],
        }),
      });

      const result = await service.fetch('anthropic', 'sk-ant-test');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('claude-3-opus');
    });

    it('should return [] when data is not array', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: null }),
      });

      const result = await service.fetch('anthropic', 'key');
      expect(result).toEqual([]);
    });

    it('should send x-api-key header for api_key auth', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await service.fetch('anthropic', 'sk-ant-test');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'anthropic-version': '2023-06-01',
            'x-api-key': 'sk-ant-test',
          }),
        }),
      );
    });

    it('should send bearer header + beta for subscription auth', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await service.fetch('anthropic', 'token', 'subscription');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'anthropic-version': '2023-06-01',
            Authorization: 'Bearer token',
            'anthropic-beta': 'oauth-2025-04-20',
          }),
        }),
      );
    });
  });

  /* ── Gemini provider ── */

  describe('parseGemini (via gemini provider)', () => {
    it('should parse valid Gemini response', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-2.5-pro',
              displayName: 'Gemini 2.5 Pro',
              supportedGenerationMethods: ['generateContent'],
              inputTokenLimit: 1000000,
            },
          ],
        }),
      });

      const result = await service.fetch('gemini', 'gemini-key');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'gemini-2.5-pro',
          displayName: 'Gemini 2.5 Pro',
          provider: 'gemini',
          contextWindow: 1000000,
        }),
      );
    });

    it('should use id as displayName when displayName missing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-flash',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      });

      const result = await service.fetch('gemini', 'key');
      expect(result[0].displayName).toBe('gemini-flash');
    });

    it('should default contextWindow to 1000000 when inputTokenLimit missing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-test',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      });

      const result = await service.fetch('gemini', 'key');
      expect(result[0].contextWindow).toBe(1000000);
    });

    it('should filter out models without generateContent', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-pro',
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/embedding-001',
              supportedGenerationMethods: ['embedContent'],
            },
            {
              name: 'models/no-methods',
            },
            {
              name: 123,
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      });

      const result = await service.fetch('gemini', 'key');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gemini-pro');
    });

    it('should return [] when models is not array', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ models: 'wrong' }),
      });

      const result = await service.fetch('gemini', 'key');
      expect(result).toEqual([]);
    });

    it('should embed key in URL and send no headers', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      });

      await service.fetch('gemini', 'my-gem-key');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('key=my-gem-key'),
        expect.objectContaining({ headers: {} }),
      );
    });
  });

  /* ── OpenRouter provider ── */

  describe('parseOpenRouter (via openrouter provider)', () => {
    it('should parse valid OpenRouter response with pricing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'openai/gpt-4',
              name: 'GPT-4',
              context_length: 8192,
              architecture: { output_modalities: ['text'] },
              pricing: { prompt: '0.00003', completion: '0.00006' },
            },
          ],
        }),
      });

      const result = await service.fetch('openrouter', '');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'openai/gpt-4',
          displayName: 'GPT-4',
          provider: 'openrouter',
          contextWindow: 8192,
          inputPricePerToken: 0.00003,
          outputPricePerToken: 0.00006,
        }),
      );
    });

    it('should filter out non-text output modality models', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'text-only',
              architecture: { output_modalities: ['text'] },
            },
            {
              id: 'image-model',
              architecture: { output_modalities: ['image'] },
            },
            {
              id: 'multi-modal',
              architecture: { output_modalities: ['text', 'image'] },
            },
          ],
        }),
      });

      const result = await service.fetch('openrouter', '');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('text-only');
    });

    it('should include models with empty output_modalities', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'empty-modalities',
              architecture: { output_modalities: [] },
            },
          ],
        }),
      });

      const result = await service.fetch('openrouter', '');
      expect(result).toHaveLength(1);
    });

    it('should include models without architecture field', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'no-arch' }],
        }),
      });

      const result = await service.fetch('openrouter', '');
      expect(result).toHaveLength(1);
    });

    it('should handle missing pricing fields', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'no-pricing' }],
        }),
      });

      const result = await service.fetch('openrouter', '');
      expect(result[0].inputPricePerToken).toBeNull();
      expect(result[0].outputPricePerToken).toBeNull();
    });

    it('should handle non-finite pricing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'bad-pricing',
              pricing: { prompt: 'NaN', completion: 'Infinity' },
            },
          ],
        }),
      });

      const result = await service.fetch('openrouter', '');
      expect(result[0].inputPricePerToken).toBeNull();
      expect(result[0].outputPricePerToken).toBeNull();
    });

    it('should use id as displayName when name is missing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'model/test' }],
        }),
      });

      const result = await service.fetch('openrouter', '');
      expect(result[0].displayName).toBe('model/test');
    });

    it('should default contextWindow to 128000', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'no-ctx' }],
        }),
      });

      const result = await service.fetch('openrouter', '');
      expect(result[0].contextWindow).toBe(128000);
    });

    it('should filter out entries without string id', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ name: 'no-id' }, { id: 42 }],
        }),
      });

      const result = await service.fetch('openrouter', '');
      expect(result).toEqual([]);
    });

    it('should return [] when data is not array', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const result = await service.fetch('openrouter', '');
      expect(result).toEqual([]);
    });
  });

  /* ── Ollama provider ── */

  describe('parseOllama (via ollama provider)', () => {
    it('should parse valid Ollama response', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            { name: 'llama3:latest', details: { family: 'llama', parameter_size: '8B' } },
            { name: 'codellama', details: { family: 'llama' } },
          ],
        }),
      });

      const result = await service.fetch('ollama', '');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'llama3',
          displayName: 'llama3',
          provider: 'ollama',
          contextWindow: 128000,
          inputPricePerToken: 0,
          outputPricePerToken: 0,
          qualityScore: 2,
        }),
      );
      expect(result[1].id).toBe('codellama');
    });

    it('should strip :latest suffix from model name', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: 'mistral:latest' }],
        }),
      });

      const result = await service.fetch('ollama', '');
      expect(result[0].id).toBe('mistral');
    });

    it('should filter out entries without string name', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: 'valid' }, { name: 123 }, {}],
        }),
      });

      const result = await service.fetch('ollama', '');
      expect(result).toHaveLength(1);
    });

    it('should return [] when models is not array', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ models: null }),
      });

      const result = await service.fetch('ollama', '');
      expect(result).toEqual([]);
    });

    it('should send no headers', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      });

      await service.fetch('ollama', '');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers: {} }),
      );
    });
  });

  /* ── OpenAI subscription parser ── */

  describe('parseOpenaiSubscription (via openai provider with subscription authType)', () => {
    it('should parse valid Codex models response', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              slug: 'gpt-5.3-codex',
              display_name: 'GPT-5.3 Codex',
              context_window: 192000,
              visibility: 'list',
              supported_in_api: true,
              priority: 10,
            },
            {
              slug: 'gpt-5.2-codex',
              display_name: 'GPT-5.2 Codex',
              context_window: 200000,
              visibility: 'list',
              supported_in_api: true,
            },
          ],
        }),
      });

      const result = await service.fetch('openai', 'oauth-token', 'subscription');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'gpt-5.3-codex',
          displayName: 'GPT-5.3 Codex',
          provider: 'openai',
          contextWindow: 192000,
          inputPricePerToken: 0,
          outputPricePerToken: 0,
          capabilityCode: true,
          qualityScore: 3,
        }),
      );
      expect(result[1].id).toBe('gpt-5.2-codex');
    });

    it('should filter out models with visibility !== list', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            { slug: 'visible-model', visibility: 'list' },
            { slug: 'hidden-model', visibility: 'hidden' },
            { slug: 'no-visibility' },
          ],
        }),
      });

      const result = await service.fetch('openai', 'token', 'subscription');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('visible-model');
    });

    it('should use slug as displayName when display_name is missing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ slug: 'gpt-5.4', visibility: 'list' }],
        }),
      });

      const result = await service.fetch('openai', 'token', 'subscription');
      expect(result[0].displayName).toBe('gpt-5.4');
    });

    it('should default context_window to 200000', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ slug: 'test-model', visibility: 'list' }],
        }),
      });

      const result = await service.fetch('openai', 'token', 'subscription');
      expect(result[0].contextWindow).toBe(200000);
    });

    it('should return [] when models is not an array', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ models: 'not-array' }),
      });

      const result = await service.fetch('openai', 'token', 'subscription');
      expect(result).toEqual([]);
    });

    it('should return [] when models is missing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const result = await service.fetch('openai', 'token', 'subscription');
      expect(result).toEqual([]);
    });

    it('should filter out entries without string slug', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            { slug: 123, visibility: 'list' },
            { visibility: 'list' },
            { slug: 'valid', visibility: 'list' },
          ],
        }),
      });

      const result = await service.fetch('openai', 'token', 'subscription');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('valid');
    });

    it('should send Codex CLI headers', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      });

      await service.fetch('openai', 'my-oauth-token', 'subscription');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://chatgpt.com/backend-api/codex/models?client_version=0.99.0',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-oauth-token',
            originator: 'codex_cli_rs',
          }),
        }),
      );
    });
  });

  /* ── OpenAI subscription routing ── */

  it('should route openai+subscription to openai-subscription config', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ models: [] }),
    });

    await service.fetch('openai', 'token', 'subscription');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('chatgpt.com/backend-api/codex/models'),
      expect.anything(),
    );
  });

  it('should use regular openai config when authType is not subscription', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await service.fetch('openai', 'sk-key', 'api_key');

    expect(fetchSpy).toHaveBeenCalledWith('https://api.openai.com/v1/models', expect.anything());
  });

  /* ── Case insensitivity ── */

  it('should handle provider ID case-insensitively', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'model' }] }),
    });

    const result = await service.fetch('OpenAI', 'key');
    expect(result).toHaveLength(1);
  });

  /* ── Endpoint function (gemini) ── */

  it('should call endpoint function when endpoint is a function', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ models: [] }),
    });

    await service.fetch('gemini', 'special&key');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('key=special%26key'),
      expect.anything(),
    );
  });

  /* ── Non-ok response masks api key ── */

  it('should mask api key in warning log for non-ok response', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 403 });

    const result = await service.fetch('gemini', 'secret-key');
    expect(result).toEqual([]);
  });
});
