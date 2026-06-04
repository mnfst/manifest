import { CustomProviderController } from './custom-provider/custom-provider.controller';
import { CustomProviderService } from './custom-provider/custom-provider.service';
import { ProviderService } from './routing-core/provider.service';

const mockUser = { id: 'user-1' } as never;

describe('CustomProviderController', () => {
  let controller: CustomProviderController;
  let mockCustomProviderService: Record<string, jest.Mock>;
  let mockProviderService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockCustomProviderService = {
      list: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({
        id: 'cp-1',
        name: 'Groq',
        base_url: 'https://api.groq.com/v1',
        models: [{ model_name: 'llama-3.1-70b' }],
        created_at: '2026-03-04T00:00:00Z',
      }),
      update: jest.fn().mockResolvedValue({
        id: 'cp-1',
        name: 'Updated Groq',
        base_url: 'https://api.groq.com/v2',
        models: [{ model_name: 'llama-3.1-70b' }],
        created_at: '2026-03-04T00:00:00Z',
      }),
      remove: jest.fn().mockResolvedValue(undefined),
      probeModels: jest.fn().mockResolvedValue([{ model_name: 'm1' }, { model_name: 'm2' }]),
    };
    mockProviderService = {
      getProviders: jest.fn().mockResolvedValue([]),
    };

    controller = new CustomProviderController(
      mockCustomProviderService as unknown as CustomProviderService,
      mockProviderService as unknown as ProviderService,
    );
  });

  /* ── list ── */

  describe('list', () => {
    it('returns mapped custom providers with has_api_key, scoped by the current user', async () => {
      mockCustomProviderService.list.mockResolvedValue([
        {
          id: 'cp-1',
          name: 'Groq',
          base_url: 'https://api.groq.com/v1',
          api_kind: 'openai',
          models: [{ model_name: 'llama' }],
          created_at: '2026-03-04',
        },
      ]);
      mockProviderService.getProviders.mockResolvedValue([
        { provider: 'custom:cp-1', api_key_encrypted: 'enc-value' },
      ]);

      const result = await controller.list(mockUser);

      expect(mockCustomProviderService.list).toHaveBeenCalledWith('user-1');
      expect(mockProviderService.getProviders).toHaveBeenCalledWith('user-1');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'cp-1',
        name: 'Groq',
        base_url: 'https://api.groq.com/v1',
        api_kind: 'openai',
        has_api_key: true,
        models: [{ model_name: 'llama' }],
        created_at: '2026-03-04',
      });
    });

    it('returns has_api_key false when no matching user provider', async () => {
      mockCustomProviderService.list.mockResolvedValue([
        {
          id: 'cp-1',
          name: 'Local',
          base_url: 'http://localhost:8000',
          models: [],
          created_at: '2026-03-04',
        },
      ]);
      mockProviderService.getProviders.mockResolvedValue([]);

      const result = await controller.list(mockUser);

      expect(result[0].has_api_key).toBe(false);
    });

    it('returns has_api_key false when user provider has no key', async () => {
      mockCustomProviderService.list.mockResolvedValue([
        {
          id: 'cp-1',
          name: 'Local',
          base_url: 'http://localhost:8000',
          models: [],
          created_at: '2026-03-04',
        },
      ]);
      mockProviderService.getProviders.mockResolvedValue([
        { provider: 'custom:cp-1', api_key_encrypted: null },
      ]);

      const result = await controller.list(mockUser);

      expect(result[0].has_api_key).toBe(false);
    });

    it('returns empty array when no custom providers but still queries user_providers', async () => {
      const result = await controller.list(mockUser);
      expect(result).toEqual([]);
      expect(mockProviderService.getProviders).toHaveBeenCalled();
    });
  });

  /* ── create ── */

  describe('create', () => {
    it('creates a user-scoped custom provider and returns mapped response', async () => {
      mockProviderService.getProviders.mockResolvedValue([
        { provider: 'custom:cp-1', api_key_encrypted: 'encrypted' },
      ]);

      const body = {
        name: 'Groq',
        base_url: 'https://api.groq.com/v1',
        apiKey: 'gsk_test',
        models: [{ model_name: 'llama-3.1-70b' }],
      };

      const result = await controller.create(mockUser, body as never);

      expect(mockCustomProviderService.create).toHaveBeenCalledWith('user-1', body);
      expect(result.id).toBe('cp-1');
      expect(result.name).toBe('Groq');
      expect(result.has_api_key).toBe(true);
    });

    it('returns has_api_key false when no user provider found', async () => {
      mockProviderService.getProviders.mockResolvedValue([]);

      const body = {
        name: 'Local',
        base_url: 'http://localhost:8000',
        models: [{ model_name: 'model' }],
      };

      const result = await controller.create(mockUser, body as never);

      expect(result.has_api_key).toBe(false);
    });
  });

  /* ── update ── */

  describe('update', () => {
    it('updates a user-scoped custom provider and returns mapped response', async () => {
      mockProviderService.getProviders.mockResolvedValue([
        { provider: 'custom:cp-1', api_key_encrypted: 'encrypted' },
      ]);

      const body = { name: 'Updated Groq' };

      const result = await controller.update(mockUser, 'cp-1', body as never);

      expect(mockCustomProviderService.update).toHaveBeenCalledWith('cp-1', 'user-1', body);
      expect(result.id).toBe('cp-1');
      expect(result.name).toBe('Updated Groq');
      expect(result.has_api_key).toBe(true);
    });

    it('returns has_api_key false when no user provider found', async () => {
      mockProviderService.getProviders.mockResolvedValue([]);

      const result = await controller.update(mockUser, 'cp-1', {
        name: 'Updated',
      } as never);

      expect(result.has_api_key).toBe(false);
    });
  });

  /* ── remove ── */

  describe('remove', () => {
    it('removes a user-scoped custom provider and returns ok', async () => {
      const result = await controller.remove(mockUser, 'cp-1');

      expect(mockCustomProviderService.remove).toHaveBeenCalledWith('user-1', 'cp-1');
      expect(result).toEqual({ ok: true });
    });
  });

  /* ── probe ── */

  describe('probe', () => {
    it('returns the probed models', async () => {
      const result = await controller.probe({
        base_url: 'http://host.docker.internal:8000/v1',
        apiKey: 'sk-x',
      } as never);

      expect(mockCustomProviderService.probeModels).toHaveBeenCalledWith(
        'http://host.docker.internal:8000/v1',
        'sk-x',
        undefined,
        undefined,
      );
      expect(result).toEqual({ models: [{ model_name: 'm1' }, { model_name: 'm2' }] });
    });

    it('forwards api_kind to the service when provided in the body', async () => {
      await controller.probe({
        base_url: 'https://api.anthropic.com',
        apiKey: 'sk-ant-x',
        api_kind: 'anthropic',
      } as never);
      expect(mockCustomProviderService.probeModels).toHaveBeenCalledWith(
        'https://api.anthropic.com',
        'sk-ant-x',
        'anthropic',
        undefined,
      );
    });

    it('forwards provider_name so probe results can be price-enriched', async () => {
      await controller.probe({
        base_url: 'https://api.kilo.ai/api/gateway',
        apiKey: 'kilo-x',
        provider_name: 'Kilo Gateway',
      } as never);
      expect(mockCustomProviderService.probeModels).toHaveBeenCalledWith(
        'https://api.kilo.ai/api/gateway',
        'kilo-x',
        undefined,
        'Kilo Gateway',
      );
    });
  });
});
