import { GlobalProvidersController } from './global-providers.controller';
import { ProviderService } from './routing-core/provider.service';
import { ModelDiscoveryService } from '../model-discovery/model-discovery.service';
import { OllamaSyncService } from '../database/ollama-sync.service';

const user = { id: 'user-1' } as never;

describe('GlobalProvidersController', () => {
  let providerService: {
    getGlobalProviders: jest.Mock;
    upsertGlobalProvider: jest.Mock;
    renameGlobalKey: jest.Mock;
    reorderGlobalKeys: jest.Mock;
    removeGlobalProvider: jest.Mock;
  };
  let discoveryService: {
    discoverModels: jest.Mock;
    refreshGlobalProvider: jest.Mock;
  };
  let ollamaSync: { sync: jest.Mock };
  let controller: GlobalProvidersController;

  beforeEach(() => {
    providerService = {
      getGlobalProviders: jest.fn().mockResolvedValue([]),
      upsertGlobalProvider: jest.fn(),
      renameGlobalKey: jest.fn(),
      reorderGlobalKeys: jest.fn(),
      removeGlobalProvider: jest.fn().mockResolvedValue({ notifications: [] }),
    };
    discoveryService = {
      discoverModels: jest.fn().mockResolvedValue([]),
      refreshGlobalProvider: jest.fn().mockResolvedValue({ ok: true }),
    };
    ollamaSync = { sync: jest.fn().mockResolvedValue({ count: 0 }) };

    controller = new GlobalProvidersController(
      providerService as unknown as ProviderService,
      discoveryService as unknown as ModelDiscoveryService,
      ollamaSync as unknown as OllamaSyncService,
    );
  });

  it('lists global providers without leaking encrypted keys', async () => {
    providerService.getGlobalProviders.mockResolvedValue([
      {
        id: 'p1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
        api_key_encrypted: 'secret',
        key_prefix: 'sk-test',
        label: 'Default',
        priority: 0,
        region: null,
        connected_at: '2026-01-01T00:00:00.000Z',
        models_fetched_at: null,
        cached_models: [{ id: 'gpt-4o' }],
      },
    ]);

    const result = await controller.list(user);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'p1',
        has_api_key: true,
        cached_model_count: 1,
      }),
    ]);
    expect(result[0]).not.toHaveProperty('api_key_encrypted');
  });

  it('connects a global provider and triggers model discovery', async () => {
    const provider = {
      id: 'p1',
      provider: 'openai',
      auth_type: 'api_key',
      is_active: true,
      label: 'Default',
      priority: 0,
      connected_at: '2026-01-01T00:00:00.000Z',
    };
    providerService.upsertGlobalProvider.mockResolvedValue({ provider, isNew: true });

    const result = await controller.upsert(user, {
      provider: 'openai',
      apiKey: 'sk-test',
      authType: 'api_key',
    });

    expect(providerService.upsertGlobalProvider).toHaveBeenCalledWith(
      'user-1',
      'openai',
      'sk-test',
      'api_key',
      undefined,
      undefined,
    );
    expect(discoveryService.discoverModels).toHaveBeenCalledWith(provider);
    expect(result.id).toBe('p1');
  });

  it('renames, reorders, refreshes, and removes global provider rows', async () => {
    providerService.renameGlobalKey.mockResolvedValue({
      id: 'p1',
      provider: 'openai',
      auth_type: 'api_key',
      label: 'Work',
      priority: 0,
    });
    providerService.reorderGlobalKeys.mockResolvedValue([{ id: 'p1', label: 'Work', priority: 0 }]);

    await controller.renameKey(
      user,
      { provider: 'openai', label: 'Default' },
      { newLabel: 'Work' },
    );
    await controller.reorderKeys(user, 'openai', { labels: ['Work'] });
    await controller.refreshProviderModels(user, 'openai', { authType: 'api_key' });
    const removed = await controller.remove(user, 'openai', { authType: 'api_key', label: 'Work' });

    expect(providerService.renameGlobalKey).toHaveBeenCalledWith(
      'user-1',
      'openai',
      'api_key',
      'Default',
      'Work',
    );
    expect(providerService.reorderGlobalKeys).toHaveBeenCalledWith('user-1', 'openai', 'api_key', [
      'Work',
    ]);
    expect(discoveryService.refreshGlobalProvider).toHaveBeenCalledWith(
      'user-1',
      'openai',
      'api_key',
    );
    expect(providerService.removeGlobalProvider).toHaveBeenCalledWith(
      'user-1',
      'openai',
      'api_key',
      'Work',
    );
    expect(removed).toEqual({ ok: true, notifications: [] });
  });
});
