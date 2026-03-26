// Mock typeorm to avoid path-scurry native dependency issue
jest.mock('typeorm', () => ({
  Repository: jest.fn(),
  IsNull: jest.fn().mockReturnValue({ _type: 'isNull' }),
  In: jest.fn((values: string[]) => ({ _type: 'in', _value: values })),
}));

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

// Mock fs for config reading (includes writeFileSync/mkdirSync used by local-mode.constants)
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
import { existsSync, readFileSync } from 'fs';

function makeMockRepo() {
  return {
    count: jest.fn().mockResolvedValue(0),
    insert: jest.fn().mockResolvedValue({}),
    upsert: jest.fn().mockResolvedValue({}),
    find: jest.fn().mockResolvedValue([]),
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
    it('runs full bootstrap sequence', async () => {
      await service.onModuleInit();
      // Wait for background discovery to complete
      await new Promise((r) => setTimeout(r, 10));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { LOCAL_USER_ID } = require('../common/constants/local-mode.constants');
      const tenantInsertArg = mockTenantRepo.insert.mock.calls[0][0];
      expect(tenantInsertArg.name).toBe(LOCAL_USER_ID);

      expect(mockTenantRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'local-tenant-001',
          name: 'local-user-001',
        }),
      );
      expect(mockAgentRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'local-agent-001',
          name: 'local-agent',
          tenant_id: 'local-tenant-001',
        }),
      );
    });

    it('skips tenant/agent when tenant already exists', async () => {
      mockTenantRepo.count.mockResolvedValue(1);

      await service.onModuleInit();

      expect(mockTenantRepo.insert).not.toHaveBeenCalled();
      expect(mockAgentRepo.insert).not.toHaveBeenCalled();
    });
  });

  describe('config reading', () => {
    it('does not register API key when config file missing', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { existsSync } = require('fs');
      (existsSync as jest.Mock).mockReturnValue(false);

      await service.onModuleInit();

      expect(mockAgentKeyRepo.upsert).not.toHaveBeenCalled();
    });

    it('returns null when readFileSync throws (catches error in readApiKeyFromConfig)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { existsSync, readFileSync } = require('fs');
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      await service.onModuleInit();

      // readApiKeyFromConfig returns null on error, so no key registration
      expect(mockAgentKeyRepo.insert).not.toHaveBeenCalled();
    });

    it('registers API key when config file exists with apiKey', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({ apiKey: 'mnfst_test_key_12345' }),
      );

      await service.onModuleInit();

      expect(mockAgentKeyRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'local-otlp-key-001',
          label: 'Local OTLP ingest key',
          tenant_id: 'local-tenant-001',
          agent_id: 'local-agent-001',
          is_active: true,
        }),
        ['id'],
      );
    });

    it('skips API key registration when key hash already exists', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({ apiKey: 'mnfst_test_key_12345' }),
      );
      mockAgentKeyRepo.count.mockResolvedValue(1);

      await service.onModuleInit();

      expect(mockAgentKeyRepo.upsert).not.toHaveBeenCalled();
    });

    it('does not register when apiKey is not a string', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ apiKey: 12345 }));

      await service.onModuleInit();

      expect(mockAgentKeyRepo.upsert).not.toHaveBeenCalled();
    });

    it('reconciles API key even when tenant already exists', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({ apiKey: 'mnfst_test_key_12345' }),
      );
      mockTenantRepo.count.mockResolvedValue(1);

      await service.onModuleInit();

      expect(mockTenantRepo.insert).not.toHaveBeenCalled();
      expect(mockAgentKeyRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'local-otlp-key-001',
          tenant_id: 'local-tenant-001',
          agent_id: 'local-agent-001',
        }),
        ['id'],
      );
    });
  });

  describe('fixupRoutingAgentIds', () => {
    it('updates orphaned provider rows to LOCAL_AGENT_ID', async () => {
      const orphanedProvider = { id: 'p1', provider: 'openai', agent_id: null };
      mockProviderRepo.find.mockResolvedValue([orphanedProvider]);
      mockTierRepo.find.mockResolvedValue([]);

      await service.onModuleInit();

      expect(mockProviderRepo.find).toHaveBeenCalledWith({
        where: { agent_id: expect.anything() },
      });
      expect(orphanedProvider.agent_id).toBe('local-agent-001');
      expect(mockProviderRepo.save).toHaveBeenCalledWith(orphanedProvider);
    });

    it('updates orphaned tier rows to LOCAL_AGENT_ID', async () => {
      const orphanedTier = { id: 't1', tier: 'simple', agent_id: null };
      mockProviderRepo.find.mockResolvedValue([]);
      mockTierRepo.find.mockResolvedValue([orphanedTier]);

      await service.onModuleInit();

      expect(mockTierRepo.find).toHaveBeenCalledWith({
        where: { agent_id: expect.anything() },
      });
      expect(orphanedTier.agent_id).toBe('local-agent-001');
      expect(mockTierRepo.save).toHaveBeenCalledWith(orphanedTier);
    });

    it('updates both orphaned providers and tiers', async () => {
      const provider1 = { id: 'p1', provider: 'openai', agent_id: null };
      const provider2 = { id: 'p2', provider: 'anthropic', agent_id: null };
      const tier1 = { id: 't1', tier: 'simple', agent_id: null };
      mockProviderRepo.find.mockResolvedValue([provider1, provider2]);
      mockTierRepo.find.mockResolvedValue([tier1]);

      await service.onModuleInit();

      expect(provider1.agent_id).toBe('local-agent-001');
      expect(provider2.agent_id).toBe('local-agent-001');
      expect(tier1.agent_id).toBe('local-agent-001');
      expect(mockProviderRepo.save).toHaveBeenCalledTimes(2);
      expect(mockTierRepo.save).toHaveBeenCalledTimes(1);
    });

    it('does nothing when no orphaned rows exist', async () => {
      mockProviderRepo.find.mockResolvedValue([]);
      mockTierRepo.find.mockResolvedValue([]);

      await service.onModuleInit();

      expect(mockProviderRepo.save).not.toHaveBeenCalled();
      expect(mockTierRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('recalculateTiersIfNeeded', () => {
    it('recalculates tiers when active providers exist on startup', async () => {
      mockProviderRepo.count.mockResolvedValue(2);

      await service.onModuleInit();

      expect(mockModuleRef.get).toHaveBeenCalled();
      expect(mockRecalculate).toHaveBeenCalledWith('local-agent-001');
    });

    it('skips tier recalculation when no active providers', async () => {
      mockProviderRepo.count.mockResolvedValue(0);

      await service.onModuleInit();

      expect(mockRecalculate).not.toHaveBeenCalled();
    });

    it('handles tier recalculation failure gracefully', async () => {
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
    it('calls discoverAllForAgent in background after bootstrap', async () => {
      await service.onModuleInit();
      // Wait for background promise to resolve
      await new Promise((r) => setTimeout(r, 10));

      expect(mockDiscoverAllForAgent).toHaveBeenCalledWith('local-agent-001');
    });

    it('handles background discovery failure gracefully', async () => {
      mockDiscoverAllForAgent.mockRejectedValue(new Error('network error'));

      await expect(service.onModuleInit()).resolves.not.toThrow();
      // Wait for background promise to settle
      await new Promise((r) => setTimeout(r, 10));
    });

    it('recalculates tiers after successful discovery', async () => {
      mockProviderRepo.count.mockResolvedValue(1);

      await service.onModuleInit();
      await new Promise((r) => setTimeout(r, 10));

      // recalculate should be called: once in onModuleInit and once after discovery
      expect(mockRecalculate).toHaveBeenCalledWith('local-agent-001');
    });

    it('handles moduleRef.get failure for ModelDiscoveryService gracefully', async () => {
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

    it('handles outer .catch when discoverModelsInBackground rejects unexpectedly', async () => {
      // Override the private method to reject, triggering the outer .catch on line 52

      jest
        .spyOn(service as any, 'discoverModelsInBackground')
        .mockRejectedValue(new Error('unexpected rejection'));

      await expect(service.onModuleInit()).resolves.not.toThrow();
      await new Promise((r) => setTimeout(r, 10));
    });
  });
});
