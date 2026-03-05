import { NotFoundException } from '@nestjs/common';
import { CustomProviderController } from './custom-provider.controller';
import { CustomProviderService } from './custom-provider.service';

const mockUser = { id: 'user-1' } as never;

describe('CustomProviderController', () => {
  let controller: CustomProviderController;
  let mockCustomProviderService: Record<string, jest.Mock>;
  let mockAgentRepo: Record<string, jest.Mock>;
  let mockTenantRepo: Record<string, jest.Mock>;
  let mockProviderRepo: Record<string, jest.Mock>;

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
    };
    mockTenantRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'tenant-001', name: 'user-1' }),
    };
    mockAgentRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'agent-001', name: 'test-agent' }),
    };
    mockProviderRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };

    controller = new CustomProviderController(
      mockCustomProviderService as unknown as CustomProviderService,
      mockAgentRepo as never,
      mockTenantRepo as never,
      mockProviderRepo as never,
    );
  });

  /* ── resolveAgent ── */

  describe('resolveAgent', () => {
    it('throws NotFoundException when tenant is not found', async () => {
      mockTenantRepo.findOne.mockResolvedValue(null);
      await expect(controller.list(mockUser, { agentName: 'test-agent' } as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when agent is not found', async () => {
      mockAgentRepo.findOne.mockResolvedValue(null);
      await expect(controller.list(mockUser, { agentName: 'missing' } as never)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  /* ── list ── */

  describe('list', () => {
    it('returns mapped custom providers with has_api_key', async () => {
      mockCustomProviderService.list.mockResolvedValue([
        {
          id: 'cp-1',
          name: 'Groq',
          base_url: 'https://api.groq.com/v1',
          models: [{ model_name: 'llama' }],
          created_at: '2026-03-04',
        },
      ]);
      mockProviderRepo.find.mockResolvedValue([
        { provider: 'custom:cp-1', api_key_encrypted: 'enc-value' },
      ]);

      const result = await controller.list(mockUser, { agentName: 'test-agent' } as never);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'cp-1',
        name: 'Groq',
        base_url: 'https://api.groq.com/v1',
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
      mockProviderRepo.find.mockResolvedValue([]);

      const result = await controller.list(mockUser, { agentName: 'test-agent' } as never);

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
      mockProviderRepo.find.mockResolvedValue([
        { provider: 'custom:cp-1', api_key_encrypted: null },
      ]);

      const result = await controller.list(mockUser, { agentName: 'test-agent' } as never);

      expect(result[0].has_api_key).toBe(false);
    });

    it('returns empty array when no custom providers', async () => {
      const result = await controller.list(mockUser, { agentName: 'test-agent' } as never);
      expect(result).toEqual([]);
    });
  });

  /* ── create ── */

  describe('create', () => {
    it('creates custom provider and returns mapped response', async () => {
      mockProviderRepo.findOne.mockResolvedValue({
        api_key_encrypted: 'encrypted',
      });

      const body = {
        name: 'Groq',
        base_url: 'https://api.groq.com/v1',
        apiKey: 'gsk_test',
        models: [{ model_name: 'llama-3.1-70b' }],
      };

      const result = await controller.create(
        mockUser,
        { agentName: 'test-agent' } as never,
        body as never,
      );

      expect(mockCustomProviderService.create).toHaveBeenCalledWith('agent-001', 'user-1', body);
      expect(result.id).toBe('cp-1');
      expect(result.name).toBe('Groq');
      expect(result.has_api_key).toBe(true);
    });

    it('returns has_api_key false when no user provider found', async () => {
      mockProviderRepo.findOne.mockResolvedValue(null);

      const body = {
        name: 'Local',
        base_url: 'http://localhost:8000',
        models: [{ model_name: 'model' }],
      };

      const result = await controller.create(
        mockUser,
        { agentName: 'test-agent' } as never,
        body as never,
      );

      expect(result.has_api_key).toBe(false);
    });
  });

  /* ── update ── */

  describe('update', () => {
    it('updates custom provider and returns mapped response', async () => {
      mockProviderRepo.findOne.mockResolvedValue({
        api_key_encrypted: 'encrypted',
      });

      const body = { name: 'Updated Groq' };

      const result = await controller.update(mockUser, 'test-agent', 'cp-1', body as never);

      expect(mockCustomProviderService.update).toHaveBeenCalledWith(
        'agent-001',
        'cp-1',
        'user-1',
        body,
      );
      expect(result.id).toBe('cp-1');
      expect(result.name).toBe('Updated Groq');
      expect(result.has_api_key).toBe(true);
    });

    it('returns has_api_key false when no user provider found', async () => {
      mockProviderRepo.findOne.mockResolvedValue(null);

      const result = await controller.update(mockUser, 'test-agent', 'cp-1', {
        name: 'Updated',
      } as never);

      expect(result.has_api_key).toBe(false);
    });

    it('propagates NotFoundException through resolveAgent', async () => {
      mockTenantRepo.findOne.mockResolvedValue(null);

      await expect(
        controller.update(mockUser, 'test-agent', 'cp-1', { name: 'X' } as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  /* ── remove ── */

  describe('remove', () => {
    it('removes custom provider and returns ok', async () => {
      const result = await controller.remove(mockUser, 'test-agent', 'cp-1');

      expect(mockCustomProviderService.remove).toHaveBeenCalledWith('agent-001', 'cp-1');
      expect(result).toEqual({ ok: true });
    });

    it('propagates NotFoundException through resolveAgent', async () => {
      mockTenantRepo.findOne.mockResolvedValue(null);

      await expect(controller.remove(mockUser, 'test-agent', 'cp-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
