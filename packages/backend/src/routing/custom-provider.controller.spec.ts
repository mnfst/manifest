import { NotFoundException } from '@nestjs/common';
import { CustomProviderController } from './custom-provider/custom-provider.controller';
import { CustomProviderService } from './custom-provider/custom-provider.service';
import { ProviderService } from './routing-core/provider.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import { Agent } from '../entities/agent.entity';

const mockUser = { id: 'user-1' } as never;

describe('CustomProviderController', () => {
  let controller: CustomProviderController;
  let mockCustomProviderService: Record<string, jest.Mock>;
  let mockProviderService: Record<string, jest.Mock>;
  let mockResolveAgent: Record<string, jest.Mock>;

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
    mockResolveAgent = {
      resolve: jest.fn().mockResolvedValue({ id: 'agent-001', name: 'test-agent' } as Agent),
    };

    controller = new CustomProviderController(
      mockCustomProviderService as unknown as CustomProviderService,
      mockProviderService as unknown as ProviderService,
      mockResolveAgent as unknown as ResolveAgentService,
    );
  });

  /* ── resolveAgent ── */

  describe('resolveAgent', () => {
    it('throws NotFoundException when tenant is not found', async () => {
      mockResolveAgent.resolve.mockRejectedValue(new NotFoundException('Tenant not found'));
      await expect(controller.list(mockUser, { agentName: 'test-agent' } as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when agent is not found', async () => {
      mockResolveAgent.resolve.mockRejectedValue(
        new NotFoundException('Agent "missing" not found'),
      );
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
      mockProviderService.getProviders.mockResolvedValue([
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
      mockProviderService.getProviders.mockResolvedValue([]);

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
      mockProviderService.getProviders.mockResolvedValue([
        { provider: 'custom:cp-1', api_key_encrypted: null },
      ]);

      const result = await controller.list(mockUser, { agentName: 'test-agent' } as never);

      expect(result[0].has_api_key).toBe(false);
    });

    it('returns empty array when no custom providers and skips user_providers query', async () => {
      const result = await controller.list(mockUser, { agentName: 'test-agent' } as never);
      expect(result).toEqual([]);
      expect(mockProviderService.getProviders).toHaveBeenCalled();
    });
  });

  /* ── create ── */

  describe('create', () => {
    it('creates custom provider and returns mapped response', async () => {
      mockProviderService.getProviders.mockResolvedValue([
        { provider: 'custom:cp-1', api_key_encrypted: 'encrypted' },
      ]);

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
      mockProviderService.getProviders.mockResolvedValue([]);

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
      mockProviderService.getProviders.mockResolvedValue([
        { provider: 'custom:cp-1', api_key_encrypted: 'encrypted' },
      ]);

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
      mockProviderService.getProviders.mockResolvedValue([]);

      const result = await controller.update(mockUser, 'test-agent', 'cp-1', {
        name: 'Updated',
      } as never);

      expect(result.has_api_key).toBe(false);
    });

    it('propagates NotFoundException through resolveAgent', async () => {
      mockResolveAgent.resolve.mockRejectedValue(new NotFoundException('Tenant not found'));

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
      mockResolveAgent.resolve.mockRejectedValue(new NotFoundException('Tenant not found'));

      await expect(controller.remove(mockUser, 'test-agent', 'cp-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  /* ── probe ── */

  describe('probe', () => {
    it('resolves the agent (authz) and returns the probed models', async () => {
      const result = await controller.probe(mockUser, 'test-agent', {
        base_url: 'http://host.docker.internal:8000/v1',
        apiKey: 'sk-x',
      } as never);

      expect(mockResolveAgent.resolve).toHaveBeenCalledWith('user-1', 'test-agent');
      expect(mockCustomProviderService.probeModels).toHaveBeenCalledWith(
        'http://host.docker.internal:8000/v1',
        'sk-x',
        undefined,
      );
      expect(result).toEqual({ models: [{ model_name: 'm1' }, { model_name: 'm2' }] });
    });

    it('forwards api_kind to the service when provided in the body', async () => {
      await controller.probe(mockUser, 'test-agent', {
        base_url: 'https://api.anthropic.com',
        apiKey: 'sk-ant-x',
        api_kind: 'anthropic',
      } as never);
      expect(mockCustomProviderService.probeModels).toHaveBeenCalledWith(
        'https://api.anthropic.com',
        'sk-ant-x',
        'anthropic',
      );
    });

    it('propagates NotFoundException from resolveAgent (unauthorized agent)', async () => {
      mockResolveAgent.resolve.mockRejectedValue(new NotFoundException('Agent not found'));
      await expect(
        controller.probe(mockUser, 'other', {
          base_url: 'http://host.docker.internal:8000/v1',
        } as never),
      ).rejects.toThrow(NotFoundException);
      expect(mockCustomProviderService.probeModels).not.toHaveBeenCalled();
    });
  });
});
