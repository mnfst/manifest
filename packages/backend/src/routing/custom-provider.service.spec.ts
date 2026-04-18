jest.mock('../common/utils/url-validation', () => ({
  validatePublicUrl: jest.fn().mockResolvedValue(undefined),
}));

import { BadRequestException } from '@nestjs/common';
import { CustomProviderService } from './custom-provider/custom-provider.service';
import { validatePublicUrl } from '../common/utils/url-validation';

const mockValidatePublicUrl = validatePublicUrl as jest.MockedFunction<typeof validatePublicUrl>;

describe('CustomProviderService (static helpers)', () => {
  describe('providerKey', () => {
    it('returns custom:<uuid> format', () => {
      expect(CustomProviderService.providerKey('abc-123')).toBe('custom:abc-123');
    });
  });

  describe('modelKey', () => {
    it('returns custom:<uuid>/<modelName> format', () => {
      expect(CustomProviderService.modelKey('abc-123', 'llama-3.1-70b')).toBe(
        'custom:abc-123/llama-3.1-70b',
      );
    });
  });

  describe('rawModelName', () => {
    it('strips the custom prefix', () => {
      expect(CustomProviderService.rawModelName('custom:abc-123/llama-3.1-70b')).toBe(
        'llama-3.1-70b',
      );
    });

    it('returns the name as-is if no slash', () => {
      expect(CustomProviderService.rawModelName('gpt-4o')).toBe('gpt-4o');
    });
  });

  describe('isCustom', () => {
    it('returns true for custom: prefix', () => {
      expect(CustomProviderService.isCustom('custom:abc-123')).toBe(true);
    });

    it('returns false for regular providers', () => {
      expect(CustomProviderService.isCustom('openai')).toBe(false);
      expect(CustomProviderService.isCustom('anthropic')).toBe(false);
    });
  });

  describe('extractId', () => {
    it('extracts UUID from provider key', () => {
      expect(CustomProviderService.extractId('custom:abc-123')).toBe('abc-123');
    });
  });
});

describe('CustomProviderService (with mocks)', () => {
  let service: CustomProviderService;
  let mockRepo: Record<string, jest.Mock>;
  let mockProviderService: Record<string, jest.Mock>;
  let mockRoutingCache: Record<string, jest.Mock>;
  let mockAutoAssign: Record<string, jest.Mock>;

  beforeEach(() => {
    mockRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockProviderService = {
      upsertProvider: jest.fn().mockResolvedValue({ provider: {}, isNew: true }),
      removeProvider: jest.fn().mockResolvedValue({ notifications: [] }),
    };
    mockRoutingCache = {
      getCustomProviders: jest.fn().mockReturnValue(null),
      setCustomProviders: jest.fn(),
      invalidateAgent: jest.fn(),
    };
    mockAutoAssign = {
      recalculate: jest.fn().mockResolvedValue(undefined),
    };

    service = new CustomProviderService(
      mockRepo as never,
      mockProviderService as never,
      mockRoutingCache as never,
      mockAutoAssign as never,
    );
  });

  describe('list', () => {
    it('queries by agent_id on cache miss', async () => {
      await service.list('agent-1');
      expect(mockRoutingCache.getCustomProviders).toHaveBeenCalledWith('agent-1');
      expect(mockRepo.find).toHaveBeenCalledWith({ where: { agent_id: 'agent-1' } });
      expect(mockRoutingCache.setCustomProviders).toHaveBeenCalledWith('agent-1', []);
    });

    it('returns cached data on cache hit', async () => {
      const cached = [{ id: 'cp-1', name: 'Groq' }];
      mockRoutingCache.getCustomProviders.mockReturnValue(cached);

      const result = await service.list('agent-1');
      expect(result).toBe(cached);
      expect(mockRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('creates provider and calls upsertProvider', async () => {
      const dto = {
        name: 'Groq',
        base_url: 'https://api.groq.com/openai/v1',
        apiKey: 'gsk_test',
        models: [
          {
            model_name: 'llama-3.1-70b',
            input_price_per_million_tokens: 0.59,
            output_price_per_million_tokens: 0.79,
          },
        ],
      };

      const result = await service.create('agent-1', 'user-1', dto as never);

      expect(result.name).toBe('Groq');
      expect(result.base_url).toBe('https://api.groq.com/openai/v1');
      expect(result.models).toHaveLength(1);
      expect(mockRepo.insert).toHaveBeenCalledTimes(1);
      expect(mockProviderService.upsertProvider).toHaveBeenCalledTimes(1);
    });

    it('rejects private/internal URLs via SSRF validation', async () => {
      mockValidatePublicUrl.mockRejectedValueOnce(
        new Error('URLs pointing to private or internal networks are not allowed'),
      );
      const dto = {
        name: 'Evil',
        base_url: 'http://127.0.0.1:8080',
        models: [{ model_name: 'test' }],
      };
      await expect(service.create('agent-1', 'user-1', dto as never)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockValidatePublicUrl).toHaveBeenCalledWith('http://127.0.0.1:8080');
    });

    it('throws ConflictException for duplicate name', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'existing' });
      const dto = {
        name: 'Groq',
        base_url: 'https://api.groq.com/openai/v1',
        models: [{ model_name: 'test' }],
      };
      await expect(service.create('agent-1', 'user-1', dto as never)).rejects.toThrow(
        'already exists',
      );
    });

    it('preserves undefined (null) prices when optional model fields are omitted', async () => {
      const dto = {
        name: 'Local',
        base_url: 'http://localhost:8000',
        models: [{ model_name: 'my-model' }],
      };
      const result = await service.create('agent-1', 'user-1', dto as never);

      // Model should preserve undefined prices, default context window
      expect(result.models[0].input_price_per_million_tokens).toBeUndefined();
      expect(result.models[0].output_price_per_million_tokens).toBeUndefined();
      expect(result.models[0].context_window).toBe(128000);
    });

    it('stores explicit zero prices as 0', async () => {
      const dto = {
        name: 'Free',
        base_url: 'http://localhost:8000',
        models: [
          {
            model_name: 'free-model',
            input_price_per_million_tokens: 0,
            output_price_per_million_tokens: 0,
          },
        ],
      };
      const result = await service.create('agent-1', 'user-1', dto as never);

      expect(result.models[0].input_price_per_million_tokens).toBe(0);
      expect(result.models[0].output_price_per_million_tokens).toBe(0);
    });

    it('passes through capability flags to stored models', async () => {
      const dto = {
        name: 'Gateway',
        base_url: 'https://proxy.example.com/v1',
        models: [
          {
            model_name: 'claude-opus',
            capability_reasoning: true,
            capability_code: true,
          },
        ],
      };
      const result = await service.create('agent-1', 'user-1', dto as never);

      expect(result.models[0].capability_reasoning).toBe(true);
      expect(result.models[0].capability_code).toBe(true);
    });

    it('stores undefined capabilities when not provided (backward compat)', async () => {
      const dto = {
        name: 'Legacy',
        base_url: 'https://api.example.com/v1',
        models: [{ model_name: 'old-model' }],
      };
      const result = await service.create('agent-1', 'user-1', dto as never);

      expect(result.models[0].capability_reasoning).toBeUndefined();
      expect(result.models[0].capability_code).toBeUndefined();
    });

    it('creates multiple models in the custom provider', async () => {
      const dto = {
        name: 'Multi',
        base_url: 'https://api.example.com/v1',
        models: [
          { model_name: 'model-a', input_price_per_million_tokens: 1.0 },
          { model_name: 'model-b', output_price_per_million_tokens: 2.0 },
        ],
      };
      const result = await service.create('agent-1', 'user-1', dto as never);

      expect(result.models).toHaveLength(2);
      expect(mockRepo.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('removes provider and custom provider row', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'cp-1',
        agent_id: 'agent-1',
        name: 'Groq',
      });

      await service.remove('agent-1', 'cp-1');

      expect(mockProviderService.removeProvider).toHaveBeenCalledTimes(1);
      expect(mockRepo.remove).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when not found', async () => {
      await expect(service.remove('agent-1', 'nonexistent')).rejects.toThrow(
        'Custom provider not found',
      );
    });

    it('continues if removeProvider throws (partial creation)', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'cp-1',
        agent_id: 'agent-1',
        name: 'Groq',
      });
      mockProviderService.removeProvider.mockRejectedValue(new Error('Provider not found'));

      await service.remove('agent-1', 'cp-1');

      // Should still remove the custom provider
      expect(mockRepo.remove).toHaveBeenCalledTimes(1);
    });
  });

  describe('getById', () => {
    it('returns the custom provider when found', async () => {
      const cp = { id: 'cp-1', name: 'Groq' };
      mockRepo.findOne.mockResolvedValue(cp);

      const result = await service.getById('cp-1');
      expect(result).toBe(cp);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'cp-1' } });
    });

    it('returns null when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.getById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    const existingCp = {
      id: 'cp-1',
      agent_id: 'agent-1',
      name: 'Groq',
      base_url: 'https://api.groq.com/openai/v1',
      models: [
        {
          model_name: 'llama-3.1-70b',
          input_price_per_million_tokens: 0.59,
          output_price_per_million_tokens: 0.79,
          context_window: 128000,
        },
      ],
      created_at: '2026-03-04T00:00:00Z',
    };

    beforeEach(() => {
      mockRepo.findOne.mockResolvedValue({ ...existingCp });
    });

    it('updates name and base_url', async () => {
      // First call: find provider, second call: uniqueness check
      mockRepo.findOne.mockResolvedValueOnce({ ...existingCp }).mockResolvedValueOnce(null);

      const result = await service.update('agent-1', 'cp-1', 'user-1', {
        name: 'Updated Groq',
        base_url: 'https://new-url.com/v1',
      } as never);

      expect(result.name).toBe('Updated Groq');
      expect(result.base_url).toBe('https://new-url.com/v1');
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });

    it('rejects private URL on base_url update', async () => {
      mockValidatePublicUrl.mockRejectedValueOnce(
        new Error('URLs pointing to private or internal networks are not allowed'),
      );
      await expect(
        service.update('agent-1', 'cp-1', 'user-1', {
          base_url: 'http://10.0.0.5:3000',
        } as never),
      ).rejects.toThrow(BadRequestException);
      expect(mockValidatePublicUrl).toHaveBeenCalledWith('http://10.0.0.5:3000');
    });

    it('throws NotFoundException when provider not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('agent-1', 'nonexistent', 'user-1', { name: 'X' } as never),
      ).rejects.toThrow('Custom provider not found');
    });

    it('checks name uniqueness when name changes', async () => {
      // First call: find the provider being updated
      // Second call: check for duplicate name
      mockRepo.findOne
        .mockResolvedValueOnce({ ...existingCp })
        .mockResolvedValueOnce({ id: 'cp-other', name: 'Taken' });

      await expect(
        service.update('agent-1', 'cp-1', 'user-1', { name: 'Taken' } as never),
      ).rejects.toThrow('already exists');
    });

    it('skips uniqueness check when name unchanged', async () => {
      await service.update('agent-1', 'cp-1', 'user-1', { name: 'Groq' } as never);

      // findOne called once for the provider lookup, not a second time for uniqueness
      expect(mockRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('updates models when provided', async () => {
      await service.update('agent-1', 'cp-1', 'user-1', {
        models: [{ model_name: 'new-model', input_price_per_million_tokens: 1.0 }],
      } as never);

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRoutingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('updates API key when explicitly provided', async () => {
      await service.update('agent-1', 'cp-1', 'user-1', {
        apiKey: 'new-key',
      } as never);

      expect(mockProviderService.upsertProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'custom:cp-1',
        'new-key',
      );
    });

    it('clears API key when apiKey is empty string', async () => {
      await service.update('agent-1', 'cp-1', 'user-1', {
        apiKey: '',
      } as never);

      expect(mockProviderService.upsertProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'custom:cp-1',
        '',
      );
    });

    it('does not call upsertProvider when apiKey is not in dto', async () => {
      mockRepo.findOne.mockResolvedValueOnce({ ...existingCp }).mockResolvedValueOnce(null);

      await service.update('agent-1', 'cp-1', 'user-1', {
        name: 'New Name',
      } as never);

      expect(mockProviderService.upsertProvider).not.toHaveBeenCalled();
    });

    it('recalculates tiers when models change without apiKey', async () => {
      await service.update('agent-1', 'cp-1', 'user-1', {
        models: [{ model_name: 'new-model' }],
      } as never);

      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('agent-1');
      expect(mockProviderService.upsertProvider).not.toHaveBeenCalled();
    });

    it('invalidates routing cache after save', async () => {
      mockRepo.findOne.mockResolvedValueOnce({ ...existingCp }).mockResolvedValueOnce(null);

      await service.update('agent-1', 'cp-1', 'user-1', { name: 'New Name' } as never);

      expect(mockRoutingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('passes through capability flags when models are updated', async () => {
      const result = await service.update('agent-1', 'cp-1', 'user-1', {
        models: [
          {
            model_name: 'new-model',
            capability_reasoning: true,
            capability_code: false,
          },
        ],
      } as never);

      expect(result.models[0].capability_reasoning).toBe(true);
      expect(result.models[0].capability_code).toBe(false);
    });

    it('does not double-recalculate when both models and apiKey change', async () => {
      await service.update('agent-1', 'cp-1', 'user-1', {
        models: [{ model_name: 'new-model' }],
        apiKey: 'new-key',
      } as never);

      // upsertProvider internally recalculates, so autoAssign should NOT be called
      expect(mockProviderService.upsertProvider).toHaveBeenCalledTimes(1);
      expect(mockAutoAssign.recalculate).not.toHaveBeenCalled();
    });
  });
});
