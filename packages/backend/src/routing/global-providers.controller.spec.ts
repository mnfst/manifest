import { GlobalProvidersController } from './global-providers.controller';
import { ProviderService } from './routing-core/provider.service';
import type { AuthUser } from '../auth/auth.instance';
import { serializeProviderConnection } from './provider-response';

const mockUser = { id: 'user-42' } as AuthUser;

describe('GlobalProvidersController', () => {
  let controller: GlobalProvidersController;
  let mockProviderService: { getProviders: jest.Mock };

  const rowWithModels = {
    id: 'p1',
    provider: 'openai',
    auth_type: 'api_key' as const,
    is_active: true,
    api_key_encrypted: 'enc-secret',
    key_prefix: 'sk-proj-',
    label: 'Work',
    priority: 0,
    region: null,
    connected_at: '2025-01-01T00:00:00.000Z',
    models_fetched_at: '2026-04-01T10:00:00.000Z',
    cached_models: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }],
  };

  const rowWithoutModels = {
    id: 'p2',
    provider: 'anthropic',
    auth_type: undefined as undefined,
    is_active: false,
    api_key_encrypted: null as null,
    key_prefix: undefined as undefined,
    label: undefined as undefined,
    priority: 1,
    region: undefined as undefined,
    connected_at: '2025-06-01T00:00:00.000Z',
    models_fetched_at: undefined as undefined,
    cached_models: null as null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockProviderService = {
      getProviders: jest.fn().mockResolvedValue([rowWithModels, rowWithoutModels]),
    };

    controller = new GlobalProvidersController(mockProviderService as unknown as ProviderService);
  });

  describe('list', () => {
    it('calls getProviders with the authenticated user id', async () => {
      await controller.list(mockUser);
      expect(mockProviderService.getProviders).toHaveBeenCalledWith('user-42');
    });

    it('maps rows to the projected shape', async () => {
      const result = await controller.list(mockUser);

      expect(result).toHaveLength(2);

      // First row: full data
      expect(result[0]).toEqual({
        id: 'p1',
        provider: 'openai',
        auth_type: 'api_key',
        is_active: true,
        has_api_key: true,
        key_prefix: 'sk-proj-',
        label: 'Work',
        priority: 0,
        region: null,
        connected_at: '2025-01-01T00:00:00.000Z',
        models_fetched_at: '2026-04-01T10:00:00.000Z',
        cached_model_count: 2,
      });

      // Second row: null/undefined fallbacks
      expect(result[1]).toEqual({
        id: 'p2',
        provider: 'anthropic',
        auth_type: 'api_key', // ?? 'api_key' fallback
        is_active: false,
        has_api_key: false, // api_key_encrypted is null → false
        key_prefix: null, // ?? null fallback
        label: undefined,
        priority: 1,
        region: null, // ?? null fallback
        connected_at: '2025-06-01T00:00:00.000Z',
        models_fetched_at: null, // ?? null fallback
        cached_model_count: 0, // cached_models is null → 0
      });
    });

    it('returns cached_model_count: 2 for row with two models', async () => {
      const result = await controller.list(mockUser);
      expect(result[0].cached_model_count).toBe(2);
    });

    it('returns cached_model_count: 0 when cached_models is null', async () => {
      const result = await controller.list(mockUser);
      expect(result[1].cached_model_count).toBe(0);
    });

    it('returns has_api_key: true when api_key_encrypted is set', async () => {
      const result = await controller.list(mockUser);
      expect(result[0].has_api_key).toBe(true);
    });

    it('returns has_api_key: false when api_key_encrypted is null', async () => {
      const result = await controller.list(mockUser);
      expect(result[1].has_api_key).toBe(false);
    });

    it('does not expose api_key_encrypted in the response', async () => {
      const result = await controller.list(mockUser);
      for (const row of result) {
        expect(row).not.toHaveProperty('api_key_encrypted');
      }
    });

    it('returns an empty array when the user has no providers', async () => {
      mockProviderService.getProviders.mockResolvedValue([]);
      const result = await controller.list(mockUser);
      expect(result).toEqual([]);
    });
  });
});
