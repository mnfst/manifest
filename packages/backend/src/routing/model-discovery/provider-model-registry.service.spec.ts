import { ProviderModelRegistryService } from './provider-model-registry.service';

function makeMockRepo(providers: Array<{ provider: string; cached_models: unknown }> = []) {
  return {
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(providers),
    }),
  };
}

describe('ProviderModelRegistryService', () => {
  describe('registerModels', () => {
    it('should register models for a provider', () => {
      const service = new ProviderModelRegistryService(makeMockRepo() as never);
      service.registerModels('openai', ['gpt-4o', 'gpt-4-turbo']);

      const confirmed = service.getConfirmedModels('openai');
      expect(confirmed).not.toBeNull();
      expect(confirmed!.has('gpt-4o')).toBe(true);
      expect(confirmed!.has('gpt-4-turbo')).toBe(true);
    });

    it('should merge models when called multiple times for the same provider', () => {
      const service = new ProviderModelRegistryService(makeMockRepo() as never);
      service.registerModels('openai', ['gpt-4o']);
      service.registerModels('openai', ['gpt-4-turbo']);

      const confirmed = service.getConfirmedModels('openai');
      expect(confirmed!.has('gpt-4o')).toBe(true);
      expect(confirmed!.has('gpt-4-turbo')).toBe(true);
    });

    it('should store model IDs in lowercase for case-insensitive matching', () => {
      const service = new ProviderModelRegistryService(makeMockRepo() as never);
      service.registerModels('OpenAI', ['GPT-4o']);

      const confirmed = service.getConfirmedModels('openai');
      expect(confirmed).not.toBeNull();
      expect(confirmed!.has('gpt-4o')).toBe(true);
    });
  });

  describe('getConfirmedModels', () => {
    it('should return null for unknown provider', () => {
      const service = new ProviderModelRegistryService(makeMockRepo() as never);
      expect(service.getConfirmedModels('unknown')).toBeNull();
    });

    it('should be case-insensitive on provider ID', () => {
      const service = new ProviderModelRegistryService(makeMockRepo() as never);
      service.registerModels('Anthropic', ['claude-opus-4-6']);

      expect(service.getConfirmedModels('anthropic')).not.toBeNull();
      expect(service.getConfirmedModels('ANTHROPIC')).not.toBeNull();
    });
  });

  describe('isModelConfirmed', () => {
    it('should return true for confirmed model', () => {
      const service = new ProviderModelRegistryService(makeMockRepo() as never);
      service.registerModels('openai', ['gpt-4o']);

      expect(service.isModelConfirmed('openai', 'gpt-4o')).toBe(true);
    });

    it('should return false for unconfirmed model', () => {
      const service = new ProviderModelRegistryService(makeMockRepo() as never);
      service.registerModels('openai', ['gpt-4o']);

      expect(service.isModelConfirmed('openai', 'phantom-model')).toBe(false);
    });

    it('should return null for unknown provider', () => {
      const service = new ProviderModelRegistryService(makeMockRepo() as never);

      expect(service.isModelConfirmed('unknown', 'some-model')).toBeNull();
    });

    it('should be case-insensitive on both provider and model', () => {
      const service = new ProviderModelRegistryService(makeMockRepo() as never);
      service.registerModels('OpenAI', ['GPT-4o']);

      expect(service.isModelConfirmed('openai', 'gpt-4o')).toBe(true);
    });
  });

  describe('onApplicationBootstrap', () => {
    it('should load models from cached user_providers data', async () => {
      const providers = [
        {
          provider: 'openai',
          cached_models: [
            { id: 'gpt-4o', displayName: 'GPT-4o' },
            { id: 'gpt-4-turbo', displayName: 'GPT-4 Turbo' },
          ],
        },
        {
          provider: 'anthropic',
          cached_models: [{ id: 'claude-opus-4-6', displayName: 'Claude Opus' }],
        },
      ];
      const service = new ProviderModelRegistryService(makeMockRepo(providers) as never);

      await service.onApplicationBootstrap();

      expect(service.isModelConfirmed('openai', 'gpt-4o')).toBe(true);
      expect(service.isModelConfirmed('openai', 'gpt-4-turbo')).toBe(true);
      expect(service.isModelConfirmed('anthropic', 'claude-opus-4-6')).toBe(true);
    });

    it('should skip providers with non-array cached_models', async () => {
      const providers = [{ provider: 'openai', cached_models: 'not-an-array' }];
      const service = new ProviderModelRegistryService(makeMockRepo(providers) as never);

      await service.onApplicationBootstrap();

      expect(service.getConfirmedModels('openai')).toBeNull();
    });

    it('should handle empty cached_models array', async () => {
      const providers = [{ provider: 'openai', cached_models: [] }];
      const service = new ProviderModelRegistryService(makeMockRepo(providers) as never);

      await service.onApplicationBootstrap();

      expect(service.getConfirmedModels('openai')).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      const mockRepo = {
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockRejectedValue(new Error('DB down')),
        }),
      };
      const service = new ProviderModelRegistryService(mockRepo as never);

      await expect(service.onApplicationBootstrap()).resolves.not.toThrow();
      expect(service.getConfirmedModels('openai')).toBeNull();
    });

    it('should merge models from multiple providers with same provider ID', async () => {
      const providers = [
        {
          provider: 'openai',
          cached_models: [{ id: 'gpt-4o' }],
        },
        {
          provider: 'openai',
          cached_models: [{ id: 'gpt-4-turbo' }],
        },
      ];
      const service = new ProviderModelRegistryService(makeMockRepo(providers) as never);

      await service.onApplicationBootstrap();

      expect(service.isModelConfirmed('openai', 'gpt-4o')).toBe(true);
      expect(service.isModelConfirmed('openai', 'gpt-4-turbo')).toBe(true);
    });

    it('should not register models when providers list is empty', async () => {
      const service = new ProviderModelRegistryService(makeMockRepo([]) as never);

      await service.onApplicationBootstrap();

      expect(service.getConfirmedModels('openai')).toBeNull();
    });
  });
});
