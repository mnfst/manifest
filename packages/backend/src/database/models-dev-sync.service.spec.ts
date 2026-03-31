import { ModelsDevSyncService } from './models-dev-sync.service';

const MOCK_API_RESPONSE = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    models: {
      'claude-opus-4-6': {
        id: 'claude-opus-4-6',
        name: 'Claude Opus 4.6',
        family: 'claude-opus',
        reasoning: true,
        tool_call: true,
        structured_output: false,
        cost: { input: 5.0, output: 25.0, cache_read: 0.5, cache_write: 6.25 },
        limit: { context: 1000000, output: 128000 },
        modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
      },
      'claude-sonnet-4-6': {
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        family: 'claude-sonnet',
        cost: { input: 3.0, output: 15.0 },
        limit: { context: 200000, output: 8192 },
        modalities: { input: ['text'], output: ['text'] },
      },
    },
  },
  google: {
    id: 'google',
    name: 'Google',
    models: {
      'gemini-2.5-pro': {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        cost: { input: 1.25, output: 10.0 },
        limit: { context: 1048576, output: 65536 },
        modalities: { input: ['text', 'image'], output: ['text'] },
      },
      'gemini-live-2.5-flash': {
        id: 'gemini-live-2.5-flash',
        name: 'Gemini Live 2.5 Flash',
        modalities: { input: ['audio'], output: ['audio'] },
        cost: { input: 0.5, output: 2.0 },
        limit: { context: 100000 },
      },
    },
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    models: {
      'gpt-4o': {
        id: 'gpt-4o',
        name: 'GPT-4o',
        cost: { input: 2.5, output: 10.0 },
        limit: { context: 128000, output: 16384 },
        modalities: { input: ['text', 'image'], output: ['text'] },
      },
    },
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    models: {
      'deepseek-chat': {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        modalities: { input: ['text'], output: ['text'] },
      },
    },
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral',
    models: {
      'mistral-medium-latest': {
        id: 'mistral-medium-latest',
        name: 'Mistral Medium',
        cost: { input: 0.4, output: 2.0 },
        limit: { context: 128000 },
        modalities: { input: ['text'], output: ['text'] },
      },
      'mistral-small-latest': {
        id: 'mistral-small-latest',
        name: 'Mistral Small',
        cost: { input: 0.1, output: 0.3 },
        limit: { context: 128000 },
        modalities: { input: ['text'], output: ['text'] },
      },
      'mistral-large-latest': {
        id: 'mistral-large-latest',
        name: 'Mistral Large',
        cost: { input: 0.5, output: 1.5 },
        limit: { context: 128000 },
        modalities: { input: ['text'], output: ['text'] },
      },
      'mistral-nemo': {
        id: 'mistral-nemo',
        name: 'Mistral Nemo',
        cost: { input: 0.15, output: 0.15 },
        limit: { context: 128000 },
        modalities: { input: ['text'], output: ['text'] },
      },
      'open-mistral-7b': {
        id: 'open-mistral-7b',
        name: 'Mistral 7B',
        cost: { input: 0.25, output: 0.25 },
        limit: { context: 32000 },
        modalities: { input: ['text'], output: ['text'] },
      },
      'devstral-2512': {
        id: 'devstral-2512',
        name: 'Devstral',
        cost: { input: 0.4, output: 2.0 },
        limit: { context: 256000 },
        modalities: { input: ['text'], output: ['text'] },
      },
    },
  },
  xai: {
    id: 'xai',
    name: 'xAI',
    models: {
      'grok-4': {
        id: 'grok-4',
        name: 'Grok 4',
        reasoning: true,
        tool_call: true,
        cost: { input: 3.0, output: 15.0 },
        limit: { context: 256000 },
        modalities: { input: ['text'], output: ['text'] },
      },
      'grok-4-1-fast': {
        id: 'grok-4-1-fast',
        name: 'Grok 4.1 Fast',
        reasoning: true,
        tool_call: true,
        cost: { input: 0.2, output: 0.5 },
        limit: { context: 2000000 },
        modalities: { input: ['text', 'image'], output: ['text'] },
      },
      'grok-4-fast': {
        id: 'grok-4-fast',
        name: 'Grok 4 Fast',
        cost: { input: 0.2, output: 0.5 },
        limit: { context: 2000000 },
        modalities: { input: ['text'], output: ['text'] },
      },
    },
  },
  'unknown-provider': {
    id: 'unknown-provider',
    name: 'Unknown',
    models: { 'some-model': { id: 'some-model', name: 'Some Model' } },
  },
};

describe('ModelsDevSyncService', () => {
  let service: ModelsDevSyncService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new ModelsDevSyncService();
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('refreshCache', () => {
    it('should fetch, parse, and cache models from api.json', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_API_RESPONSE,
      });

      const count = await service.refreshCache();

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://models.dev/api.json',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      // anthropic: 2, google: 1 (audio excluded), openai: 1, deepseek: 1, mistral: 6, xai: 3 = 14
      expect(count).toBe(14);
    });

    it('should filter out non-text-output models', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_API_RESPONSE,
      });

      await service.refreshCache();

      // gemini-live-2.5-flash has audio-only output, should be filtered
      expect(service.lookupModel('gemini', 'gemini-live-2.5-flash')).toBeNull();
      expect(service.lookupModel('gemini', 'gemini-2.5-pro')).not.toBeNull();
    });

    it('should return 0 when fetch fails', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'));

      const count = await service.refreshCache();

      expect(count).toBe(0);
    });

    it('should return 0 when API returns non-ok status', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });

      const count = await service.refreshCache();

      expect(count).toBe(0);
    });

    it('should only include providers from PROVIDER_ID_MAP', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_API_RESPONSE,
      });

      await service.refreshCache();

      // 'unknown-provider' is not in our map, should not appear
      expect(service.getModelsForProvider('unknown-provider')).toEqual([]);
    });
  });

  describe('lookupModel', () => {
    beforeEach(async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_API_RESPONSE,
      });
      await service.refreshCache();
    });

    it('should find Anthropic models by our provider ID', () => {
      const model = service.lookupModel('anthropic', 'claude-opus-4-6');
      expect(model).not.toBeNull();
      expect(model!.name).toBe('Claude Opus 4.6');
      expect(model!.inputPricePerToken).toBe(5.0 / 1_000_000);
      expect(model!.outputPricePerToken).toBe(25.0 / 1_000_000);
      expect(model!.contextWindow).toBe(1000000);
      expect(model!.maxOutputTokens).toBe(128000);
      expect(model!.reasoning).toBe(true);
      expect(model!.toolCall).toBe(true);
    });

    it('should find Google/Gemini models via our "gemini" provider ID', () => {
      const model = service.lookupModel('gemini', 'gemini-2.5-pro');
      expect(model).not.toBeNull();
      expect(model!.name).toBe('Gemini 2.5 Pro');
      expect(model!.inputPricePerToken).toBe(1.25 / 1_000_000);
    });

    it('should return null for unknown model', () => {
      expect(service.lookupModel('anthropic', 'nonexistent')).toBeNull();
    });

    it('should return null for unmapped provider', () => {
      expect(service.lookupModel('nonexistent', 'some-model')).toBeNull();
    });

    it('should handle case-insensitive provider lookup', () => {
      const model = service.lookupModel('ANTHROPIC', 'claude-opus-4-6');
      expect(model).not.toBeNull();
    });

    it('should set null pricing for models without cost', () => {
      const model = service.lookupModel('deepseek', 'deepseek-chat');
      expect(model).not.toBeNull();
      expect(model!.inputPricePerToken).toBeNull();
      expect(model!.outputPricePerToken).toBeNull();
    });

    it('should convert cache pricing to per-token', () => {
      const model = service.lookupModel('anthropic', 'claude-opus-4-6');
      expect(model!.cacheReadPricePerToken).toBe(0.5 / 1_000_000);
      expect(model!.cacheWritePricePerToken).toBe(6.25 / 1_000_000);
    });

    it('should match model by stripping version suffix (-001)', () => {
      // Google API returns gemini-2.5-pro-001, models.dev has gemini-2.5-pro
      const model = service.lookupModel('gemini', 'gemini-2.5-pro-001');
      expect(model).not.toBeNull();
      expect(model!.name).toBe('Gemini 2.5 Pro');
    });

    it('should not strip suffix that is not a 3-digit version', () => {
      // -09-2025 is not a version suffix
      expect(service.lookupModel('gemini', 'gemini-2.5-flash-lite-preview-09-2025')).toBeNull();
    });

    it('should prefer exact match over version-stripped match', () => {
      const model = service.lookupModel('gemini', 'gemini-2.5-pro');
      expect(model).not.toBeNull();
      expect(model!.id).toBe('gemini-2.5-pro');
    });

    it('should strip date suffix to find base model (OpenAI convention)', () => {
      // OpenAI returns gpt-4o-2024-08-06, models.dev has gpt-4o
      const model = service.lookupModel('openai', 'gpt-4o-20240806');
      expect(model).not.toBeNull();
      expect(model!.name).toBe('GPT-4o');
    });

    it('should strip hyphenated date suffix', () => {
      // Some APIs return dates with hyphens: gpt-4.1-2025-04-14
      const model = service.lookupModel('openai', 'gpt-4o-2024-08-06');
      expect(model).not.toBeNull();
    });

    it('should append -latest to match alias models (Mistral convention)', () => {
      // Mistral API returns mistral-medium, models.dev has mistral-medium-latest
      const model = service.lookupModel('mistral', 'mistral-medium');
      expect(model).not.toBeNull();
      expect(model!.name).toBe('Mistral Medium');
      expect(model!.inputPricePerToken).toBe(0.4 / 1_000_000);
    });

    it('should strip date then append -latest (Mistral dated variant)', () => {
      // Mistral returns mistral-small-2603, models.dev has mistral-small-latest
      const model = service.lookupModel('mistral', 'mistral-small-20250603');
      expect(model).not.toBeNull();
      expect(model!.name).toBe('Mistral Small');
    });

    it('should not append -latest when model already ends with -latest', () => {
      const model = service.lookupModel('mistral', 'mistral-large-latest');
      expect(model).not.toBeNull();
      expect(model!.name).toBe('Mistral Large');
    });

    it('should strip Google preview variant suffix', () => {
      // Google API returns gemini-2.5-pro-preview-03-25, models.dev has gemini-2.5-pro
      const model = service.lookupModel('gemini', 'gemini-2.5-pro-preview-03-25');
      expect(model).not.toBeNull();
      expect(model!.name).toBe('Gemini 2.5 Pro');
    });

    it('should strip Google exp variant suffix', () => {
      const model = service.lookupModel('gemini', 'gemini-2.5-pro-exp-0325');
      expect(model).not.toBeNull();
      expect(model!.name).toBe('Gemini 2.5 Pro');
    });

    it('should strip -reasoning suffix (xAI convention)', () => {
      // xAI returns grok-4-1-fast-reasoning, models.dev has grok-4-1-fast
      const model = service.lookupModel('xai', 'grok-4-1-fast-reasoning');
      expect(model).not.toBeNull();
      expect(model!.name).toBe('Grok 4.1 Fast');
      expect(model!.inputPricePerToken).toBe(0.2 / 1_000_000);
    });

    it('should strip -non-reasoning suffix (xAI convention)', () => {
      const model = service.lookupModel('xai', 'grok-4-fast-non-reasoning');
      expect(model).not.toBeNull();
      expect(model!.name).toBe('Grok 4 Fast');
    });

    it('should strip 4-digit short date suffix (xAI: grok-4-0709)', () => {
      // xAI returns grok-4-0709 (July 9 release), models.dev has grok-4
      const model = service.lookupModel('xai', 'grok-4-0709');
      expect(model).not.toBeNull();
      expect(model!.name).toBe('Grok 4');
      expect(model!.inputPricePerToken).toBe(3.0 / 1_000_000);
    });

    it('should strip -latest and find dated variant (devstral-latest → devstral-2512)', () => {
      const model = service.lookupModel('mistral', 'devstral-latest');
      expect(model).not.toBeNull();
      expect(model!.name).toBe('Devstral');
      expect(model!.inputPricePerToken).toBe(0.4 / 1_000_000);
    });

    it('should strip -latest and find base name when no dated variant exists', () => {
      // mistral-nemo has no -latest sibling but base name matches
      // This tests the baseMatch path in step 10
      const model = service.lookupModel('mistral', 'mistral-nemo-latest');
      // models.dev has mistral-nemo as a key (step 10 base match)
      expect(model).not.toBeNull();
      expect(model!.name).toBe('Mistral Nemo');
    });

    it('should resolve legacy alias open-mistral-nemo → mistral-nemo', () => {
      const model = service.lookupModel('mistral', 'open-mistral-nemo');
      expect(model).not.toBeNull();
      expect(model!.name).toBe('Mistral Nemo');
    });

    it('should resolve legacy alias open-mistral-nemo-2407 → mistral-nemo', () => {
      const model = service.lookupModel('mistral', 'open-mistral-nemo-2407');
      expect(model).not.toBeNull();
      expect(model!.name).toBe('Mistral Nemo');
    });

    it('should resolve legacy alias mistral-tiny-2407 → open-mistral-7b', () => {
      const model = service.lookupModel('mistral', 'mistral-tiny-2407');
      expect(model).not.toBeNull();
      expect(model!.name).toBe('Mistral 7B');
    });

    it('should resolve legacy alias mistral-tiny-latest → open-mistral-7b', () => {
      const model = service.lookupModel('mistral', 'mistral-tiny-latest');
      expect(model).not.toBeNull();
      expect(model!.name).toBe('Mistral 7B');
    });
  });

  describe('getModelsForProvider', () => {
    beforeEach(async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_API_RESPONSE,
      });
      await service.refreshCache();
    });

    it('should return all models for a provider', () => {
      const models = service.getModelsForProvider('anthropic');
      expect(models).toHaveLength(2);
      const ids = models.map((m) => m.id);
      expect(ids).toContain('claude-opus-4-6');
      expect(ids).toContain('claude-sonnet-4-6');
    });

    it('should return empty array for unmapped provider', () => {
      expect(service.getModelsForProvider('nonexistent')).toEqual([]);
    });
  });

  describe('isProviderSupported', () => {
    it('should return true for mapped providers', () => {
      expect(service.isProviderSupported('anthropic')).toBe(true);
      expect(service.isProviderSupported('gemini')).toBe(true);
      expect(service.isProviderSupported('qwen')).toBe(true);
    });

    it('should return false for unmapped providers', () => {
      expect(service.isProviderSupported('unknown')).toBe(false);
      expect(service.isProviderSupported('ollama')).toBe(false);
    });
  });

  describe('getLastFetchedAt', () => {
    it('should return null before first fetch', () => {
      expect(service.getLastFetchedAt()).toBeNull();
    });

    it('should return a date after successful fetch', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_API_RESPONSE,
      });
      await service.refreshCache();
      expect(service.getLastFetchedAt()).toBeInstanceOf(Date);
    });
  });

  describe('onModuleInit', () => {
    it('should call refreshCache on module init', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await service.onModuleInit();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('should not throw when fetch fails during init', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'));

      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });
  });

  describe('isChatCompatible edge cases', () => {
    it('should include models with no modalities at all', async () => {
      const response = {
        openai: {
          id: 'openai',
          name: 'OpenAI',
          models: {
            'no-modalities-model': {
              id: 'no-modalities-model',
              name: 'No Modalities',
              cost: { input: 1.0, output: 2.0 },
              // No modalities field
            },
          },
        },
      };
      fetchSpy.mockResolvedValue({ ok: true, json: async () => response });

      await service.refreshCache();

      expect(service.lookupModel('openai', 'no-modalities-model')).not.toBeNull();
    });

    it('should include models with empty modalities', async () => {
      const response = {
        openai: {
          id: 'openai',
          name: 'OpenAI',
          models: {
            'empty-mod': {
              id: 'empty-mod',
              name: 'Empty Modalities',
              modalities: {},
              cost: { input: 1.0, output: 2.0 },
            },
          },
        },
      };
      fetchSpy.mockResolvedValue({ ok: true, json: async () => response });

      await service.refreshCache();

      expect(service.lookupModel('openai', 'empty-mod')).not.toBeNull();
    });

    it('should include models with empty input and output arrays', async () => {
      const response = {
        openai: {
          id: 'openai',
          name: 'OpenAI',
          models: {
            'empty-arrays': {
              id: 'empty-arrays',
              name: 'Empty Arrays',
              modalities: { input: [], output: [] },
              cost: { input: 1.0, output: 2.0 },
            },
          },
        },
      };
      fetchSpy.mockResolvedValue({ ok: true, json: async () => response });

      await service.refreshCache();

      expect(service.lookupModel('openai', 'empty-arrays')).not.toBeNull();
    });

    it('should exclude models with non-text-only output (e.g. image)', async () => {
      const response = {
        openai: {
          id: 'openai',
          name: 'OpenAI',
          models: {
            'image-model': {
              id: 'image-model',
              name: 'Image Model',
              modalities: { input: ['text'], output: ['image'] },
              cost: { input: 1.0, output: 2.0 },
            },
          },
        },
      };
      fetchSpy.mockResolvedValue({ ok: true, json: async () => response });

      await service.refreshCache();

      expect(service.lookupModel('openai', 'image-model')).toBeNull();
    });

    it('should include models with mixed text+image output (includes text)', async () => {
      const response = {
        openai: {
          id: 'openai',
          name: 'OpenAI',
          models: {
            'mixed-output': {
              id: 'mixed-output',
              name: 'Mixed Output',
              modalities: { input: ['text'], output: ['text', 'image'] },
              cost: { input: 1.0, output: 2.0 },
            },
          },
        },
      };
      fetchSpy.mockResolvedValue({ ok: true, json: async () => response });

      await service.refreshCache();

      expect(service.lookupModel('openai', 'mixed-output')).not.toBeNull();
    });

    it('should exclude models with audio-only input', async () => {
      const response = {
        openai: {
          id: 'openai',
          name: 'OpenAI',
          models: {
            'audio-in': {
              id: 'audio-in',
              name: 'Audio Input',
              modalities: { input: ['audio'], output: ['text'] },
              cost: { input: 1.0, output: 2.0 },
            },
          },
        },
      };
      fetchSpy.mockResolvedValue({ ok: true, json: async () => response });

      await service.refreshCache();

      expect(service.lookupModel('openai', 'audio-in')).toBeNull();
    });

    it('should handle case-insensitive modality checking', async () => {
      const response = {
        openai: {
          id: 'openai',
          name: 'OpenAI',
          models: {
            'caps-text': {
              id: 'caps-text',
              name: 'Upper Case Text',
              modalities: { input: ['Text', 'Image'], output: ['TEXT'] },
              cost: { input: 1.0, output: 2.0 },
            },
          },
        },
      };
      fetchSpy.mockResolvedValue({ ok: true, json: async () => response });

      await service.refreshCache();

      expect(service.lookupModel('openai', 'caps-text')).not.toBeNull();
    });
  });

  describe('parseModel edge cases', () => {
    it('should handle partial cache pricing (only cache_read)', async () => {
      const response = {
        anthropic: {
          id: 'anthropic',
          name: 'Anthropic',
          models: {
            'partial-cache': {
              id: 'partial-cache',
              name: 'Partial Cache',
              cost: { input: 1.0, output: 2.0, cache_read: 0.5 },
              modalities: { input: ['text'], output: ['text'] },
            },
          },
        },
      };
      fetchSpy.mockResolvedValue({ ok: true, json: async () => response });

      await service.refreshCache();

      const model = service.lookupModel('anthropic', 'partial-cache');
      expect(model).not.toBeNull();
      expect(model!.cacheReadPricePerToken).toBe(0.5 / 1_000_000);
      expect(model!.cacheWritePricePerToken).toBeNull();
    });

    it('should use model id as name when name field is empty', async () => {
      const response = {
        openai: {
          id: 'openai',
          name: 'OpenAI',
          models: {
            'unnamed-model': {
              id: 'unnamed-model',
              name: '',
              cost: { input: 1.0, output: 2.0 },
              modalities: { input: ['text'], output: ['text'] },
            },
          },
        },
      };
      fetchSpy.mockResolvedValue({ ok: true, json: async () => response });

      await service.refreshCache();

      const model = service.lookupModel('openai', 'unnamed-model');
      expect(model).not.toBeNull();
      expect(model!.name).toBe('unnamed-model');
    });

    it('should parse structuredOutput flag', async () => {
      const response = {
        openai: {
          id: 'openai',
          name: 'OpenAI',
          models: {
            'structured-model': {
              id: 'structured-model',
              name: 'Structured',
              structured_output: true,
              cost: { input: 1.0, output: 2.0 },
              modalities: { input: ['text'], output: ['text'] },
            },
          },
        },
      };
      fetchSpy.mockResolvedValue({ ok: true, json: async () => response });

      await service.refreshCache();

      const model = service.lookupModel('openai', 'structured-model');
      expect(model).not.toBeNull();
      expect(model!.structuredOutput).toBe(true);
    });

    it('should default structuredOutput to false when not provided', async () => {
      const response = {
        openai: {
          id: 'openai',
          name: 'OpenAI',
          models: {
            'no-so-flag': {
              id: 'no-so-flag',
              name: 'No Structured Output Flag',
              cost: { input: 1.0, output: 2.0 },
              modalities: { input: ['text'], output: ['text'] },
            },
          },
        },
      };
      fetchSpy.mockResolvedValue({ ok: true, json: async () => response });

      await service.refreshCache();

      const model = service.lookupModel('openai', 'no-so-flag');
      expect(model).not.toBeNull();
      expect(model!.structuredOutput).toBe(false);
    });
  });

  describe('refreshCache edge cases', () => {
    it('should skip providers with no models key', async () => {
      const response = {
        openai: {
          id: 'openai',
          name: 'OpenAI',
          // No models field
        },
      };
      fetchSpy.mockResolvedValue({ ok: true, json: async () => response });

      const count = await service.refreshCache();

      expect(count).toBe(0);
      expect(service.getModelsForProvider('openai')).toEqual([]);
    });

    it('should not create provider entry when all models are filtered out', async () => {
      const response = {
        openai: {
          id: 'openai',
          name: 'OpenAI',
          models: {
            'audio-only': {
              id: 'audio-only',
              name: 'Audio Only',
              modalities: { input: ['audio'], output: ['audio'] },
              cost: { input: 1.0, output: 2.0 },
            },
          },
        },
      };
      fetchSpy.mockResolvedValue({ ok: true, json: async () => response });

      const count = await service.refreshCache();

      expect(count).toBe(0);
      expect(service.getModelsForProvider('openai')).toEqual([]);
    });

    it('should replace old cache on subsequent refresh', async () => {
      // First refresh
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          openai: {
            id: 'openai',
            name: 'OpenAI',
            models: {
              'old-model': {
                id: 'old-model',
                name: 'Old Model',
                cost: { input: 1.0, output: 2.0 },
                modalities: { input: ['text'], output: ['text'] },
              },
            },
          },
        }),
      });
      await service.refreshCache();
      expect(service.lookupModel('openai', 'old-model')).not.toBeNull();

      // Second refresh with different models
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          openai: {
            id: 'openai',
            name: 'OpenAI',
            models: {
              'new-model': {
                id: 'new-model',
                name: 'New Model',
                cost: { input: 3.0, output: 4.0 },
                modalities: { input: ['text'], output: ['text'] },
              },
            },
          },
        }),
      });
      await service.refreshCache();

      expect(service.lookupModel('openai', 'old-model')).toBeNull();
      expect(service.lookupModel('openai', 'new-model')).not.toBeNull();
    });
  });

  describe('lookupModel fallback priority', () => {
    it('should not apply short date fallback when it matches version suffix', async () => {
      // grok-4-0001 should match version suffix (strategy 2), not short date (strategy 7)
      const response = {
        xai: {
          id: 'xai',
          name: 'xAI',
          models: {
            'grok-4': {
              id: 'grok-4',
              name: 'Grok 4',
              cost: { input: 3.0, output: 15.0 },
              modalities: { input: ['text'], output: ['text'] },
            },
          },
        },
      };
      fetchSpy.mockResolvedValue({ ok: true, json: async () => response });
      await service.refreshCache();

      // -001 matches VERSION_SUFFIX_RE (/\d{3}$/), strategy 2 strips it to 'grok-4'
      const model = service.lookupModel('xai', 'grok-4-001');
      expect(model).not.toBeNull();
      expect(model!.name).toBe('Grok 4');
    });

    it('should return null when no fallback strategy matches', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_API_RESPONSE,
      });
      await service.refreshCache();

      // 'totally-different' won't match any strategy
      expect(service.lookupModel('openai', 'totally-different')).toBeNull();
    });

    it('should not strip -latest when the model already ends with -latest', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_API_RESPONSE,
      });
      await service.refreshCache();

      // mistral-large-latest already ends with -latest, so step 4 is skipped
      // It should still be found via exact match (step 1)
      const model = service.lookupModel('mistral', 'mistral-large-latest');
      expect(model).not.toBeNull();
      expect(model!.name).toBe('Mistral Large');
    });

    it('should handle model that matches date suffix but no base model exists', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_API_RESPONSE,
      });
      await service.refreshCache();

      // nonexistent-model-20250514 strips to nonexistent-model which doesn't exist
      expect(service.lookupModel('openai', 'nonexistent-model-20250514')).toBeNull();
    });

    it('should try step 5 (date+latest) when no date match or latest match', async () => {
      // Mistral: mistral-small-20250103 -> strip date -> mistral-small -> try +latest -> mistral-small-latest
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_API_RESPONSE,
      });
      await service.refreshCache();

      const model = service.lookupModel('mistral', 'mistral-large-20250603');
      expect(model).not.toBeNull();
      expect(model!.name).toBe('Mistral Large');
    });

    it('should not apply reasoning suffix to non-matching models', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_API_RESPONSE,
      });
      await service.refreshCache();

      // 'grok-4-fast-turbo' does not end with -reasoning or -non-reasoning
      expect(service.lookupModel('xai', 'grok-4-fast-turbo')).toBeNull();
    });
  });

  describe('getModelsForProvider case sensitivity', () => {
    it('should be case-insensitive for provider lookup', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_API_RESPONSE,
      });
      await service.refreshCache();

      const lower = service.getModelsForProvider('anthropic');
      const upper = service.getModelsForProvider('ANTHROPIC');
      expect(lower).toEqual(upper);
      expect(lower.length).toBeGreaterThan(0);
    });
  });
});
