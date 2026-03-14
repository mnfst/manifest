import { PricingSyncService } from './pricing-sync.service';

let fetchSpy: jest.SpyInstance;

describe('PricingSyncService', () => {
  let service: PricingSyncService;

  beforeEach(() => {
    service = new PricingSyncService();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('onModuleInit', () => {
    it('calls refreshCache on init', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'openai/gpt-4o',
              pricing: { prompt: '0.0000025', completion: '0.00001' },
            },
          ],
        }),
      });

      await service.onModuleInit();
      // onModuleInit fires refreshCache without awaiting — wait for it
      await new Promise((r) => setTimeout(r, 10));
      expect(fetchSpy).toHaveBeenCalledWith('https://openrouter.ai/api/v1/models');
      expect(service.getAll().size).toBeGreaterThan(0);
    });

    it('does not throw when refreshCache rejects', async () => {
      // Make refreshCache itself reject (not just fetch) to trigger the .catch() handler
      jest.spyOn(service, 'refreshCache').mockRejectedValue(new Error('Unexpected failure'));

      await service.onModuleInit();
      // Give the async .catch time to execute
      await new Promise((r) => setTimeout(r, 10));
      // The error is caught by the .catch; no unhandled rejection
    });
  });

  describe('refreshCache', () => {
    it('populates cache with successful response', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'anthropic/claude-opus-4',
              name: 'Anthropic: Claude Opus 4',
              context_length: 200000,
              pricing: { prompt: '0.000015', completion: '0.000075' },
            },
            {
              id: 'openai/gpt-4o',
              name: 'OpenAI: GPT-4o',
              pricing: { prompt: '0.0000025', completion: '0.00001' },
            },
          ],
        }),
      });

      const count = await service.refreshCache();
      expect(count).toBe(2);

      const all = service.getAll();
      // Models stored under full OpenRouter ID only
      expect(all.has('anthropic/claude-opus-4')).toBe(true);
      expect(all.has('openai/gpt-4o')).toBe(true);
      // No canonical-only entries
      expect(all.has('claude-opus-4')).toBe(false);
      expect(all.has('gpt-4o')).toBe(false);

      const claude = all.get('anthropic/claude-opus-4')!;
      expect(claude.input).toBe(0.000015);
      expect(claude.output).toBe(0.000075);
      expect(claude.contextWindow).toBe(200000);
      expect(claude.displayName).toBe('Claude Opus 4');

      const gpt = all.get('openai/gpt-4o')!;
      expect(gpt.input).toBe(0.0000025);
      expect(gpt.output).toBe(0.00001);
      expect(gpt.contextWindow).toBeUndefined();
      expect(gpt.displayName).toBe('GPT-4o');
    });

    it('stores under full ID for openrouter/ prefixed models', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'openrouter/auto',
              name: 'Auto (best for prompt)',
              pricing: { prompt: '0.000003', completion: '0.000015' },
            },
          ],
        }),
      });

      const count = await service.refreshCache();
      expect(count).toBe(1);
      // openrouter/ models keep full ID as canonical
      expect(service.getAll().has('openrouter/auto')).toBe(true);
    });

    it('returns 0 when API returns non-OK status', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 503 });

      const count = await service.refreshCache();
      expect(count).toBe(0);
      expect(service.getAll().size).toBe(0);
    });

    it('returns 0 when fetch throws', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'));

      const count = await service.refreshCache();
      expect(count).toBe(0);
      expect(service.getAll().size).toBe(0);
    });

    it('handles response with undefined data field', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const count = await service.refreshCache();
      expect(count).toBe(0);
    });

    it('handles empty data array', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const count = await service.refreshCache();
      expect(count).toBe(0);
    });

    it('skips models with missing pricing field', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'openai/gpt-4o' }],
        }),
      });

      const count = await service.refreshCache();
      expect(count).toBe(0);
    });

    it('skips models with negative pricing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'openrouter/bad', pricing: { prompt: '-1', completion: '-1' } }],
        }),
      });

      const count = await service.refreshCache();
      expect(count).toBe(0);
    });

    it('skips models with NaN pricing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'openai/gpt-nan', pricing: { prompt: 'not-a-number', completion: '0.001' } },
          ],
        }),
      });

      const count = await service.refreshCache();
      expect(count).toBe(0);
    });

    it('skips models with Infinity pricing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'openai/gpt-inf', pricing: { prompt: 'Infinity', completion: '0.001' } }],
        }),
      });

      const count = await service.refreshCache();
      expect(count).toBe(0);
    });

    it('skips non-chat-compatible models', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'google/image-gen',
              architecture: {
                input_modalities: ['text', 'image'],
                output_modalities: ['text', 'image'],
              },
              pricing: { prompt: '0.0000005', completion: '0.000003' },
            },
          ],
        }),
      });

      const count = await service.refreshCache();
      expect(count).toBe(0);
    });

    it('accepts free models with zero pricing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'openai/gpt-free', pricing: { prompt: '0', completion: '0' } }],
        }),
      });

      const count = await service.refreshCache();
      expect(count).toBe(1);
      expect(service.lookupPricing('openai/gpt-free')!.input).toBe(0);
      expect(service.lookupPricing('openai/gpt-free')!.output).toBe(0);
    });

    it('does not overwrite canonical entry when second model has same canonical name', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'openai/model-x',
              name: 'OpenAI: Model X',
              pricing: { prompt: '0.001', completion: '0.002' },
            },
            {
              id: 'google/model-x',
              name: 'Google: Model X',
              pricing: { prompt: '0.003', completion: '0.004' },
            },
          ],
        }),
      });

      const count = await service.refreshCache();
      expect(count).toBe(2);
      // Both stored under their full OpenRouter IDs
      expect(service.lookupPricing('openai/model-x')!.input).toBe(0.001);
      expect(service.lookupPricing('google/model-x')!.input).toBe(0.003);
      // No canonical-only entry
      expect(service.lookupPricing('model-x')).toBeNull();
    });

    it('uses default 0 when prompt/completion fields are undefined', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'openai/gpt-4o', pricing: {} }],
        }),
      });

      const count = await service.refreshCache();
      expect(count).toBe(1);
      const entry = service.lookupPricing('openai/gpt-4o')!;
      expect(entry.input).toBe(0);
      expect(entry.output).toBe(0);
    });

    it('omits displayName when name is missing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'openai/gpt-4o', pricing: { prompt: '0.001', completion: '0.001' } }],
        }),
      });

      const count = await service.refreshCache();
      expect(count).toBe(1);
      expect(service.lookupPricing('openai/gpt-4o')!.displayName).toBeUndefined();
    });

    it('replaces old cache entirely on refresh', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'openai/old-model', pricing: { prompt: '0.001', completion: '0.001' } }],
        }),
      });
      await service.refreshCache();
      expect(service.lookupPricing('openai/old-model')).not.toBeNull();

      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'openai/new-model', pricing: { prompt: '0.002', completion: '0.002' } }],
        }),
      });
      await service.refreshCache();
      expect(service.lookupPricing('openai/old-model')).toBeNull();
      expect(service.lookupPricing('openai/new-model')).not.toBeNull();
    });
  });

  describe('lookupPricing', () => {
    it('returns null for unknown model', () => {
      expect(service.lookupPricing('nonexistent')).toBeNull();
    });

    it('returns entry for known model', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'openai/gpt-4o',
              pricing: { prompt: '0.0000025', completion: '0.00001' },
            },
          ],
        }),
      });

      await service.refreshCache();

      const entry = service.lookupPricing('openai/gpt-4o');
      expect(entry).not.toBeNull();
      expect(entry!.input).toBe(0.0000025);
      expect(entry!.output).toBe(0.00001);
    });

    it('returns entry by full OpenRouter ID', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'anthropic/claude-opus-4',
              pricing: { prompt: '0.000015', completion: '0.000075' },
            },
          ],
        }),
      });

      await service.refreshCache();

      const entry = service.lookupPricing('anthropic/claude-opus-4');
      expect(entry).not.toBeNull();
      expect(entry!.input).toBe(0.000015);
    });
  });

  describe('getAll', () => {
    it('returns empty map initially', () => {
      const all = service.getAll();
      expect(all).toBeInstanceOf(Map);
      expect(all.size).toBe(0);
    });

    it('returns populated map after refresh', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'openai/gpt-4o',
              pricing: { prompt: '0.001', completion: '0.002' },
            },
          ],
        }),
      });

      await service.refreshCache();
      const all = service.getAll();
      expect(all.size).toBeGreaterThan(0);
    });
  });

  describe('getLastFetchedAt', () => {
    it('returns null before any refresh', () => {
      expect(service.getLastFetchedAt()).toBeNull();
    });

    it('returns a Date after successful refresh', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await service.refreshCache();
      const ts = service.getLastFetchedAt();
      expect(ts).toBeInstanceOf(Date);
    });

    it('does not update when fetch fails', async () => {
      fetchSpy.mockRejectedValue(new Error('fail'));

      await service.refreshCache();
      expect(service.getLastFetchedAt()).toBeNull();
    });

    it('does not update when API returns non-OK', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 });

      await service.refreshCache();
      expect(service.getLastFetchedAt()).toBeNull();
    });
  });

  describe('deriveNames', () => {
    it('maps known providers correctly', () => {
      expect(service.deriveNames('anthropic/claude-opus-4')).toEqual({
        canonical: 'claude-opus-4',
        provider: 'Anthropic',
      });
      expect(service.deriveNames('openai/gpt-4o')).toEqual({
        canonical: 'gpt-4o',
        provider: 'OpenAI',
      });
      expect(service.deriveNames('google/gemini-2.5-pro')).toEqual({
        canonical: 'gemini-2.5-pro',
        provider: 'Google',
      });
      expect(service.deriveNames('deepseek/deepseek-r1')).toEqual({
        canonical: 'deepseek-r1',
        provider: 'DeepSeek',
      });
      expect(service.deriveNames('mistralai/mistral-large')).toEqual({
        canonical: 'mistral-large',
        provider: 'Mistral',
      });
      expect(service.deriveNames('meta-llama/llama-3')).toEqual({
        canonical: 'llama-3',
        provider: 'Meta',
      });
      expect(service.deriveNames('cohere/command-r')).toEqual({
        canonical: 'command-r',
        provider: 'Cohere',
      });
      expect(service.deriveNames('xai/grok-2')).toEqual({
        canonical: 'grok-2',
        provider: 'xAI',
      });
      expect(service.deriveNames('moonshotai/moonshot-v1')).toEqual({
        canonical: 'moonshot-v1',
        provider: 'Moonshot',
      });
      expect(service.deriveNames('qwen/qwen3-235b-a22b')).toEqual({
        canonical: 'qwen3-235b-a22b',
        provider: 'Alibaba',
      });
      expect(service.deriveNames('zhipuai/glm-4-plus')).toEqual({
        canonical: 'glm-4-plus',
        provider: 'Zhipu',
      });
      expect(service.deriveNames('amazon/nova-pro')).toEqual({
        canonical: 'nova-pro',
        provider: 'Amazon',
      });
    });

    it('preserves full ID for openrouter/ models', () => {
      expect(service.deriveNames('openrouter/auto')).toEqual({
        canonical: 'openrouter/auto',
        provider: 'OpenRouter',
      });
    });

    it('maps MiniMax provider correctly', () => {
      expect(service.deriveNames('minimax/minimax-m2.5')).toEqual({
        canonical: 'minimax-m2.5',
        provider: 'MiniMax',
      });
    });

    it('maps Z.ai provider correctly', () => {
      expect(service.deriveNames('z-ai/glm-5')).toEqual({
        canonical: 'glm-5',
        provider: 'Z.ai',
      });
    });

    it('title-cases unknown providers', () => {
      expect(service.deriveNames('newvendor/some-model')).toEqual({
        canonical: 'some-model',
        provider: 'Newvendor',
      });
    });

    it('handles model IDs without slash', () => {
      expect(service.deriveNames('bare-model')).toEqual({
        canonical: 'bare-model',
        provider: 'Unknown',
      });
    });
  });

  describe('extractDisplayName', () => {
    it('strips vendor prefix from OpenRouter names', () => {
      expect(
        service.extractDisplayName({
          id: 'anthropic/claude-opus-4',
          name: 'Anthropic: Claude Opus 4',
        }),
      ).toBe('Claude Opus 4');
    });

    it('returns full name when no colon-space separator', () => {
      expect(
        service.extractDisplayName({
          id: 'openrouter/auto',
          name: 'Auto (best for prompt)',
        }),
      ).toBe('Auto (best for prompt)');
    });

    it('returns empty string when name is missing', () => {
      expect(service.extractDisplayName({ id: 'openai/gpt-4o' })).toBe('');
    });
  });

  describe('isChatCompatible', () => {
    it('returns true when no architecture info', () => {
      expect(service.isChatCompatible({ id: 'test' })).toBe(true);
    });

    it('returns true when architecture has empty modalities', () => {
      expect(
        service.isChatCompatible({
          id: 'test',
          architecture: { input_modalities: [], output_modalities: [] },
        }),
      ).toBe(true);
    });

    it('returns true for text-only input and output', () => {
      expect(
        service.isChatCompatible({
          id: 'test',
          architecture: {
            input_modalities: ['text'],
            output_modalities: ['text'],
          },
        }),
      ).toBe(true);
    });

    it('returns true for multimodal input with text-only output', () => {
      expect(
        service.isChatCompatible({
          id: 'test',
          architecture: {
            input_modalities: ['text', 'image', 'file'],
            output_modalities: ['text'],
          },
        }),
      ).toBe(true);
    });

    it('returns false for non-text output modalities', () => {
      expect(
        service.isChatCompatible({
          id: 'test',
          architecture: {
            input_modalities: ['text', 'image'],
            output_modalities: ['text', 'image'],
          },
        }),
      ).toBe(false);
    });

    it('returns false when input has no text modality', () => {
      expect(
        service.isChatCompatible({
          id: 'test',
          architecture: {
            input_modalities: ['image'],
            output_modalities: ['text'],
          },
        }),
      ).toBe(false);
    });

    it('returns true when output modalities undefined but input includes text', () => {
      expect(
        service.isChatCompatible({
          id: 'test',
          architecture: { input_modalities: ['text'] },
        }),
      ).toBe(true);
    });

    it('returns true when input modalities undefined but output is text-only', () => {
      expect(
        service.isChatCompatible({
          id: 'test',
          architecture: { output_modalities: ['text'] },
        }),
      ).toBe(true);
    });
  });
});
