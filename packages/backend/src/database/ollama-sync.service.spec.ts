import { OllamaSyncService } from './ollama-sync.service';
import { ModelPricing } from '../entities/model-pricing.entity';

/* ── Helpers ── */

function makeMockRepo() {
  return {
    upsert: jest.fn().mockResolvedValue({}),
    find: jest.fn().mockResolvedValue([]),
  };
}

function makeMockCache() {
  return {
    reload: jest.fn().mockResolvedValue(undefined),
    getAll: jest.fn().mockReturnValue([]),
  };
}

function ollamaModel(
  name: string,
  family?: string,
  parameterSize?: string,
) {
  return {
    name,
    details: {
      family: family ?? undefined,
      parameter_size: parameterSize ?? undefined,
    },
  };
}

function mockFetchSuccess(models: unknown[]) {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({ models }),
  });
}

function mockFetchFailure(error: Error) {
  return jest.fn().mockRejectedValue(error);
}

function mockFetchNonOk(status: number) {
  return jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: jest.fn(),
  });
}

/* ── Tests ── */

describe('OllamaSyncService', () => {
  let service: OllamaSyncService;
  let mockRepo: ReturnType<typeof makeMockRepo>;
  let mockCache: ReturnType<typeof makeMockCache>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockRepo = makeMockRepo();
    mockCache = makeMockCache();
    service = new OllamaSyncService(
      mockRepo as never,
      mockCache as never,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  /* ── Network error handling ── */

  describe('network errors', () => {
    it('should return count 0 when Ollama is unreachable', async () => {
      global.fetch = mockFetchFailure(
        new Error('connect ECONNREFUSED 127.0.0.1:11434'),
      );

      const result = await service.sync();

      expect(result).toEqual({ count: 0 });
      expect(mockRepo.upsert).not.toHaveBeenCalled();
      expect(mockCache.reload).not.toHaveBeenCalled();
    });

    it('should return count 0 when fetch times out (abort)', async () => {
      global.fetch = mockFetchFailure(new DOMException('aborted', 'AbortError'));

      const result = await service.sync();

      expect(result).toEqual({ count: 0 });
    });

    it('should return count 0 on non-ok HTTP response', async () => {
      global.fetch = mockFetchNonOk(500);

      const result = await service.sync();

      expect(result).toEqual({ count: 0 });
      expect(mockRepo.upsert).not.toHaveBeenCalled();
    });

    it('should return count 0 on 404 response', async () => {
      global.fetch = mockFetchNonOk(404);

      const result = await service.sync();

      expect(result).toEqual({ count: 0 });
    });
  });

  /* ── Empty / missing models ── */

  describe('empty responses', () => {
    it('should return count 0 when models array is empty', async () => {
      global.fetch = mockFetchSuccess([]);

      const result = await service.sync();

      expect(result).toEqual({ count: 0 });
      expect(mockRepo.upsert).not.toHaveBeenCalled();
      expect(mockCache.reload).not.toHaveBeenCalled();
    });

    it('should return count 0 when models key is missing', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      const result = await service.sync();

      expect(result).toEqual({ count: 0 });
    });
  });

  /* ── Successful sync ── */

  describe('successful sync', () => {
    it('should upsert each model and reload cache', async () => {
      const models = [
        ollamaModel('llama3.2', 'llama'),
        ollamaModel('codellama:latest', 'llama'),
      ];
      global.fetch = mockFetchSuccess(models);

      const result = await service.sync();

      expect(result).toEqual({ count: 2 });
      expect(mockRepo.upsert).toHaveBeenCalledTimes(2);
      expect(mockCache.reload).toHaveBeenCalledTimes(1);
    });

    it('should strip :latest tag from model names', async () => {
      global.fetch = mockFetchSuccess([
        ollamaModel('mistral:latest', 'mistral'),
      ]);

      await service.sync();

      const upsertArg = mockRepo.upsert.mock.calls[0][0] as Partial<ModelPricing>;
      expect(upsertArg.model_name).toBe('mistral');
    });

    it('should not strip non-latest tags', async () => {
      global.fetch = mockFetchSuccess([
        ollamaModel('llama3.2:7b-instruct', 'llama'),
      ]);

      await service.sync();

      const upsertArg = mockRepo.upsert.mock.calls[0][0] as Partial<ModelPricing>;
      expect(upsertArg.model_name).toBe('llama3.2:7b-instruct');
    });

    it('should set provider to Ollama', async () => {
      global.fetch = mockFetchSuccess([ollamaModel('phi4', 'phi4')]);

      await service.sync();

      const upsertArg = mockRepo.upsert.mock.calls[0][0] as Partial<ModelPricing>;
      expect(upsertArg.provider).toBe('Ollama');
    });

    it('should set zero pricing for all models', async () => {
      global.fetch = mockFetchSuccess([ollamaModel('gemma2', 'gemma2')]);

      await service.sync();

      const upsertArg = mockRepo.upsert.mock.calls[0][0] as Partial<ModelPricing>;
      expect(upsertArg.input_price_per_token).toBe(0);
      expect(upsertArg.output_price_per_token).toBe(0);
    });

    it('should upsert on model_name conflict key', async () => {
      global.fetch = mockFetchSuccess([ollamaModel('test-model')]);

      await service.sync();

      expect(mockRepo.upsert).toHaveBeenCalledWith(
        expect.any(Object),
        ['model_name'],
      );
    });

    it('should set updated_at to a recent Date', async () => {
      const before = Date.now();
      global.fetch = mockFetchSuccess([ollamaModel('test-model')]);

      await service.sync();

      const upsertArg = mockRepo.upsert.mock.calls[0][0] as Partial<ModelPricing>;
      const ts = (upsertArg.updated_at as Date).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(Date.now());
    });
  });

  /* ── Capability inference: reasoning ── */

  describe('reasoning capability', () => {
    const reasoningModels = [
      'deepseek-r1',
      'deepseek-r1:70b',
      'qwq',
      'qwen3',
      'marco-o1',
      'smallthinker',
    ];

    it.each(reasoningModels)(
      'should mark %s as reasoning',
      async (name) => {
        global.fetch = mockFetchSuccess([ollamaModel(name)]);

        await service.sync();

        const arg = mockRepo.upsert.mock.calls[0][0] as Partial<ModelPricing>;
        expect(arg.capability_reasoning).toBe(true);
      },
    );

    it('should not mark non-reasoning models as reasoning', async () => {
      global.fetch = mockFetchSuccess([ollamaModel('llama3.2', 'llama')]);

      await service.sync();

      const arg = mockRepo.upsert.mock.calls[0][0] as Partial<ModelPricing>;
      expect(arg.capability_reasoning).toBe(false);
    });
  });

  /* ── Capability inference: code ── */

  describe('code capability', () => {
    const explicitCodeModels = [
      'codellama',
      'codegemma',
      'codestral',
      'starcoder',
      'starcoder2',
      'deepseek-coder',
      'deepseek-coder-v2',
      'qwen2.5-coder',
    ];

    it.each(explicitCodeModels)(
      'should mark %s as code-capable',
      async (name) => {
        global.fetch = mockFetchSuccess([ollamaModel(name)]);

        await service.sync();

        const arg = mockRepo.upsert.mock.calls[0][0] as Partial<ModelPricing>;
        expect(arg.capability_code).toBe(true);
      },
    );

    const generalFamilies = [
      ['llama3.2', 'llama'],
      ['gemma2-model', 'gemma2'],
      ['qwen2-chat', 'qwen2'],
      ['qwen2.5-instruct', 'qwen2.5'],
      ['mistral-instruct', 'mistral'],
      ['mixtral-8x7b', 'mixtral'],
      ['command-r-plus', 'command-r'],
      ['phi3-medium', 'phi3'],
      ['phi4-mini', 'phi4'],
    ];

    it.each(generalFamilies)(
      'should mark %s (family: %s) as code-capable via general family',
      async (name, family) => {
        global.fetch = mockFetchSuccess([ollamaModel(name, family)]);

        await service.sync();

        const arg = mockRepo.upsert.mock.calls[0][0] as Partial<ModelPricing>;
        expect(arg.capability_code).toBe(true);
      },
    );

    it('should not mark unknown family as code-capable', async () => {
      global.fetch = mockFetchSuccess([
        ollamaModel('tiny-llm', 'unknown-family'),
      ]);

      await service.sync();

      const arg = mockRepo.upsert.mock.calls[0][0] as Partial<ModelPricing>;
      expect(arg.capability_code).toBe(false);
    });

    it('should not mark model with no family and non-code name as code', async () => {
      global.fetch = mockFetchSuccess([ollamaModel('orca-mini')]);

      await service.sync();

      const arg = mockRepo.upsert.mock.calls[0][0] as Partial<ModelPricing>;
      expect(arg.capability_code).toBe(false);
    });
  });

  /* ── Context window inference ── */

  describe('context window', () => {
    const familyContextCases: [string, number][] = [
      ['llama', 128000],
      ['gemma', 8192],
      ['gemma2', 8192],
      ['qwen2', 128000],
      ['qwen2.5', 128000],
      ['qwen3', 128000],
      ['mistral', 32768],
      ['mixtral', 32768],
      ['phi3', 128000],
      ['phi4', 16384],
      ['command-r', 128000],
    ];

    it.each(familyContextCases)(
      'should set context window to %d for family %s',
      async (family, expected) => {
        global.fetch = mockFetchSuccess([
          ollamaModel('test-model', family),
        ]);

        await service.sync();

        const arg = mockRepo.upsert.mock.calls[0][0] as Partial<ModelPricing>;
        expect(arg.context_window).toBe(expected);
      },
    );

    it('should default to 128000 for unknown family', async () => {
      global.fetch = mockFetchSuccess([
        ollamaModel('exotic-model', 'exotic-family'),
      ]);

      await service.sync();

      const arg = mockRepo.upsert.mock.calls[0][0] as Partial<ModelPricing>;
      expect(arg.context_window).toBe(128000);
    });

    it('should default to 128000 when family is undefined', async () => {
      global.fetch = mockFetchSuccess([
        { name: 'no-details-model' },
      ]);

      await service.sync();

      const arg = mockRepo.upsert.mock.calls[0][0] as Partial<ModelPricing>;
      expect(arg.context_window).toBe(128000);
    });
  });

  /* ── Quality score computation ── */

  describe('quality score', () => {
    it('should compute and include quality_score in upsert', async () => {
      global.fetch = mockFetchSuccess([ollamaModel('llama3.2', 'llama')]);

      await service.sync();

      const arg = mockRepo.upsert.mock.calls[0][0] as Partial<ModelPricing>;
      expect(arg.quality_score).toBeDefined();
      expect(typeof arg.quality_score).toBe('number');
    });

    it('should score 2 for code-only zero-price model', async () => {
      // llama family => code capable, not reasoning, zero price => score 2
      global.fetch = mockFetchSuccess([ollamaModel('llama3.2', 'llama')]);

      await service.sync();

      const arg = mockRepo.upsert.mock.calls[0][0] as Partial<ModelPricing>;
      expect(arg.quality_score).toBe(2);
    });

    it('should score 3 for reasoning non-mini model (qwen3)', async () => {
      // qwen3 is in REASONING_MODELS, qwen3 family is in LARGE_GENERAL_FAMILIES (code)
      // => hasBoth && !isMini => 3
      global.fetch = mockFetchSuccess([ollamaModel('qwen3', 'qwen3')]);

      await service.sync();

      const arg = mockRepo.upsert.mock.calls[0][0] as Partial<ModelPricing>;
      expect(arg.quality_score).toBe(3);
    });

    it('should score 1 for model with no capabilities', async () => {
      global.fetch = mockFetchSuccess([
        ollamaModel('orca-mini', 'unknown'),
      ]);

      await service.sync();

      const arg = mockRepo.upsert.mock.calls[0][0] as Partial<ModelPricing>;
      expect(arg.quality_score).toBe(1);
    });
  });

  /* ── Multiple models in one sync ── */

  describe('batch sync', () => {
    it('should process all models and return total count', async () => {
      global.fetch = mockFetchSuccess([
        ollamaModel('llama3.2:latest', 'llama'),
        ollamaModel('deepseek-r1:latest'),
        ollamaModel('codestral:latest'),
        ollamaModel('phi4', 'phi4'),
      ]);

      const result = await service.sync();

      expect(result).toEqual({ count: 4 });
      expect(mockRepo.upsert).toHaveBeenCalledTimes(4);

      // Verify each was stripped and processed
      const names = mockRepo.upsert.mock.calls.map(
        (c) => (c[0] as Partial<ModelPricing>).model_name,
      );
      expect(names).toEqual([
        'llama3.2',
        'deepseek-r1',
        'codestral',
        'phi4',
      ]);
    });

    it('should reload cache exactly once after all upserts', async () => {
      global.fetch = mockFetchSuccess([
        ollamaModel('model-a', 'llama'),
        ollamaModel('model-b', 'gemma'),
      ]);

      await service.sync();

      expect(mockCache.reload).toHaveBeenCalledTimes(1);
      // reload must be called after the last upsert
      const lastUpsertOrder =
        mockRepo.upsert.mock.invocationCallOrder[1];
      const reloadOrder =
        mockCache.reload.mock.invocationCallOrder[0];
      expect(reloadOrder).toBeGreaterThan(lastUpsertOrder);
    });
  });
});
