// Mock typeorm to avoid path-scurry native dependency issue
jest.mock('typeorm', () => ({
  Repository: jest.fn(),
  IsNull: jest.fn().mockReturnValue({ _type: 'isNull' }),
  In: jest.fn((values: string[]) => ({ _type: 'in', _value: values })),
}));

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

// Mock entity imports
jest.mock('../entities/tenant.entity', () => ({ Tenant: jest.fn() }));
jest.mock('../entities/agent.entity', () => ({ Agent: jest.fn() }));
jest.mock('../entities/agent-api-key.entity', () => ({ AgentApiKey: jest.fn() }));
jest.mock('../entities/agent-message.entity', () => ({ AgentMessage: jest.fn() }));
jest.mock('../entities/user-provider.entity', () => ({ UserProvider: jest.fn() }));
jest.mock('../entities/tier-assignment.entity', () => ({ TierAssignment: jest.fn() }));

// Mock tier-auto-assign to avoid deep import chain
jest.mock('../routing/routing-core/tier-auto-assign.service', () => ({
  TierAutoAssignService: class TierAutoAssignService {},
}));

// Mock model-discovery to avoid deep import chain
jest.mock('../model-discovery/model-discovery.service', () => ({
  ModelDiscoveryService: class ModelDiscoveryService {},
}));

import { LocalBootstrapService } from './local-bootstrap.service';

function makeMockRepo() {
  return {
    count: jest.fn().mockResolvedValue(0),
    insert: jest.fn().mockResolvedValue({}),
    upsert: jest.fn().mockResolvedValue({}),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  };
}

describe('LocalBootstrapService', () => {
  let service: LocalBootstrapService;
  let mockTenantRepo: ReturnType<typeof makeMockRepo>;
  let mockAgentRepo: ReturnType<typeof makeMockRepo>;
  let mockAgentKeyRepo: ReturnType<typeof makeMockRepo>;
  let mockMessageRepo: ReturnType<typeof makeMockRepo>;
  let mockProviderRepo: ReturnType<typeof makeMockRepo>;
  let mockTierRepo: ReturnType<typeof makeMockRepo>;
  let mockRecalculate: jest.Mock;
  let mockDiscoverAllForAgent: jest.Mock;
  let mockModuleRef: { get: jest.Mock };

  beforeEach(() => {
    mockTenantRepo = makeMockRepo();
    mockAgentRepo = makeMockRepo();
    mockAgentKeyRepo = makeMockRepo();
    mockMessageRepo = makeMockRepo();
    mockProviderRepo = makeMockRepo();
    mockTierRepo = makeMockRepo();
    mockRecalculate = jest.fn().mockResolvedValue(undefined);
    mockDiscoverAllForAgent = jest.fn().mockResolvedValue(undefined);
    mockModuleRef = {
      get: jest.fn().mockImplementation((token) => {
        const name = typeof token === 'function' ? token.name : String(token);
        if (name === 'TierAutoAssignService') {
          return { recalculate: mockRecalculate };
        }
        if (name === 'ModelDiscoveryService') {
          return { discoverAllForAgent: mockDiscoverAllForAgent };
        }
        return {};
      }),
    };

    service = new LocalBootstrapService(
      mockTenantRepo as never,
      mockAgentRepo as never,
      mockAgentKeyRepo as never,
      mockMessageRepo as never,
      mockProviderRepo as never,
      mockTierRepo as never,
      mockModuleRef as never,
    );
  });

  describe('onModuleInit', () => {
    it('runs bootstrap without creating tenant or agent', async () => {
      await service.onModuleInit();
      await new Promise((r) => setTimeout(r, 10));

      // Should NOT auto-create tenant or agent
      expect(mockTenantRepo.insert).not.toHaveBeenCalled();
      expect(mockAgentRepo.insert).not.toHaveBeenCalled();
    });

    it('does not seed messages', async () => {
      await service.onModuleInit();

      expect(mockMessageRepo.insert).not.toHaveBeenCalled();
    });
  });

  describe('fixupRoutingAgentIds', () => {
    it('skips fixup when no active agents exist', async () => {
      mockAgentRepo.findOne.mockResolvedValue(null);

      await service.onModuleInit();

      expect(mockProviderRepo.save).not.toHaveBeenCalled();
      expect(mockTierRepo.save).not.toHaveBeenCalled();
    });

    it('updates orphaned provider rows to first active agent', async () => {
      const orphanedProvider = { id: 'p1', provider: 'openai', agent_id: null };
      mockAgentRepo.findOne.mockResolvedValue({ id: 'user-agent-1', is_active: true });
      mockProviderRepo.find.mockResolvedValue([orphanedProvider]);
      mockTierRepo.find.mockResolvedValue([]);

      await service.onModuleInit();

      expect(orphanedProvider.agent_id).toBe('user-agent-1');
      expect(mockProviderRepo.save).toHaveBeenCalledWith(orphanedProvider);
    });

    it('updates orphaned tier rows to first active agent', async () => {
      const orphanedTier = { id: 't1', tier: 'simple', agent_id: null };
      mockAgentRepo.findOne.mockResolvedValue({ id: 'user-agent-1', is_active: true });
      mockProviderRepo.find.mockResolvedValue([]);
      mockTierRepo.find.mockResolvedValue([orphanedTier]);

      await service.onModuleInit();

      expect(orphanedTier.agent_id).toBe('user-agent-1');
      expect(mockTierRepo.save).toHaveBeenCalledWith(orphanedTier);
    });

    it('does nothing when no orphaned rows exist', async () => {
      mockAgentRepo.findOne.mockResolvedValue({ id: 'user-agent-1', is_active: true });
      mockProviderRepo.find.mockResolvedValue([]);
      mockTierRepo.find.mockResolvedValue([]);

      await service.onModuleInit();

      expect(mockProviderRepo.save).not.toHaveBeenCalled();
      expect(mockTierRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('recalculateTiersIfNeeded', () => {
    it('skips when no active agents exist', async () => {
      mockAgentRepo.findOne.mockResolvedValue(null);

      await service.onModuleInit();

      expect(mockRecalculate).not.toHaveBeenCalled();
    });

    it('recalculates tiers when active providers exist', async () => {
      mockAgentRepo.findOne.mockResolvedValue({ id: 'user-agent-1', is_active: true });
      mockProviderRepo.count.mockResolvedValue(2);

      await service.onModuleInit();

      expect(mockRecalculate).toHaveBeenCalledWith('user-agent-1');
    });

    it('skips when no active providers', async () => {
      mockAgentRepo.findOne.mockResolvedValue({ id: 'user-agent-1', is_active: true });
      mockProviderRepo.count.mockResolvedValue(0);

      await service.onModuleInit();

      expect(mockRecalculate).not.toHaveBeenCalled();
    });

    it('handles failure gracefully', async () => {
      mockAgentRepo.findOne.mockResolvedValue({ id: 'user-agent-1', is_active: true });
      mockProviderRepo.count.mockResolvedValue(1);
      mockModuleRef.get.mockImplementation((token) => {
        const name = typeof token === 'function' ? token.name : String(token);
        if (name === 'TierAutoAssignService') {
          throw new Error('Module not found');
        }
        if (name === 'ModelDiscoveryService') {
          return { discoverAllForAgent: mockDiscoverAllForAgent };
        }
        return {};
      });

      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('background model discovery', () => {
    it('discovers models for active agents', async () => {
      mockAgentRepo.find.mockResolvedValue([
        { id: 'agent-1', is_active: true },
        { id: 'agent-2', is_active: true },
      ]);

      await service.onModuleInit();
      await new Promise((r) => setTimeout(r, 10));

      expect(mockDiscoverAllForAgent).toHaveBeenCalledWith('agent-1');
      expect(mockDiscoverAllForAgent).toHaveBeenCalledWith('agent-2');
    });

    it('skips discovery when no active agents', async () => {
      mockAgentRepo.find.mockResolvedValue([]);

      await service.onModuleInit();
      await new Promise((r) => setTimeout(r, 10));

      expect(mockDiscoverAllForAgent).not.toHaveBeenCalled();
    });

    it('handles discovery failure gracefully', async () => {
      mockAgentRepo.find.mockResolvedValue([{ id: 'agent-1', is_active: true }]);
      mockDiscoverAllForAgent.mockRejectedValue(new Error('network error'));

      await expect(service.onModuleInit()).resolves.not.toThrow();
      await new Promise((r) => setTimeout(r, 10));
    });

    it('handles moduleRef.get failure gracefully', async () => {
      mockAgentRepo.find.mockResolvedValue([{ id: 'agent-1', is_active: true }]);
      mockModuleRef.get.mockImplementation((token) => {
        const name = typeof token === 'function' ? token.name : String(token);
        if (name === 'ModelDiscoveryService') {
          throw new Error('ModelDiscoveryService not available');
        }
        if (name === 'TierAutoAssignService') {
          return { recalculate: mockRecalculate };
        }
        return {};
      });

      await expect(service.onModuleInit()).resolves.not.toThrow();
      await new Promise((r) => setTimeout(r, 10));
    });

    it('handles outer .catch when discoverModelsInBackground rejects', async () => {
      jest
        .spyOn(service as any, 'discoverModelsInBackground')
        .mockRejectedValue(new Error('unexpected rejection'));

      await expect(service.onModuleInit()).resolves.not.toThrow();
      await new Promise((r) => setTimeout(r, 10));
    });
  });
});
