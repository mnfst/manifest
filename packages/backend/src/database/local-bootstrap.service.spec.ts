// Mock typeorm to avoid path-scurry native dependency issue
jest.mock('typeorm', () => ({
  Repository: jest.fn(),
  IsNull: jest.fn().mockReturnValue({ _type: 'isNull' }),
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

// Mock pricing-sync to avoid deep import chain
jest.mock('./pricing-sync.service', () => ({
  PricingSyncService: jest.fn(),
}));

// Mock model-pricing-cache
jest.mock('../model-prices/model-pricing-cache.service', () => ({
  ModelPricingCacheService: jest.fn(),
}));

// Mock product telemetry
jest.mock('../common/utils/product-telemetry', () => ({
  trackEvent: jest.fn(),
}));

// Mock entity imports
jest.mock('../entities/tenant.entity', () => ({ Tenant: jest.fn() }));
jest.mock('../entities/agent.entity', () => ({ Agent: jest.fn() }));
jest.mock('../entities/agent-api-key.entity', () => ({ AgentApiKey: jest.fn() }));
jest.mock('../entities/agent-message.entity', () => ({ AgentMessage: jest.fn() }));
jest.mock('../entities/model-pricing.entity', () => ({ ModelPricing: jest.fn() }));
jest.mock('../entities/user-provider.entity', () => ({ UserProvider: jest.fn() }));
jest.mock('../entities/tier-assignment.entity', () => ({ TierAssignment: jest.fn() }));

import { LocalBootstrapService } from './local-bootstrap.service';
import { trackEvent } from '../common/utils/product-telemetry';

function makeMockRepo() {
  return {
    count: jest.fn().mockResolvedValue(0),
    insert: jest.fn().mockResolvedValue({}),
    upsert: jest.fn().mockResolvedValue({}),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockResolvedValue({}),
  };
}

describe('LocalBootstrapService', () => {
  let service: LocalBootstrapService;
  let mockTenantRepo: ReturnType<typeof makeMockRepo>;
  let mockAgentRepo: ReturnType<typeof makeMockRepo>;
  let mockAgentKeyRepo: ReturnType<typeof makeMockRepo>;
  let mockMessageRepo: ReturnType<typeof makeMockRepo>;
  let mockPricingRepo: ReturnType<typeof makeMockRepo>;
  let mockProviderRepo: ReturnType<typeof makeMockRepo>;
  let mockTierRepo: ReturnType<typeof makeMockRepo>;
  let mockPricingCache: { reload: jest.Mock };
  let mockPricingSync: { syncPricing: jest.Mock };

  beforeEach(() => {
    (trackEvent as jest.Mock).mockClear();
    mockTenantRepo = makeMockRepo();
    mockAgentRepo = makeMockRepo();
    mockAgentKeyRepo = makeMockRepo();
    mockMessageRepo = makeMockRepo();
    mockPricingRepo = makeMockRepo();
    mockProviderRepo = makeMockRepo();
    mockTierRepo = makeMockRepo();
    mockPricingCache = { reload: jest.fn().mockResolvedValue(undefined) };
    mockPricingSync = { syncPricing: jest.fn().mockResolvedValue(undefined) };

    service = new LocalBootstrapService(
      mockTenantRepo as never,
      mockAgentRepo as never,
      mockAgentKeyRepo as never,
      mockMessageRepo as never,
      mockPricingRepo as never,
      mockProviderRepo as never,
      mockTierRepo as never,
      mockPricingCache as never,
      mockPricingSync as never,
    );
  });

  describe('onModuleInit', () => {
    it('runs full bootstrap sequence', async () => {
      await service.onModuleInit();

      expect(mockPricingRepo.upsert).toHaveBeenCalled();
      expect(mockPricingCache.reload).toHaveBeenCalled();
      // Verify tenant name equals LOCAL_USER_ID (guard/bootstrap consistency)
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
      expect(mockPricingSync.syncPricing).toHaveBeenCalled();
    });

    it('skips tenant/agent when tenant already exists', async () => {
      mockTenantRepo.count.mockResolvedValue(1);

      await service.onModuleInit();

      expect(mockTenantRepo.insert).not.toHaveBeenCalled();
      expect(mockAgentRepo.insert).not.toHaveBeenCalled();
    });

    it('calls trackEvent agent_created during first bootstrap', async () => {
      await service.onModuleInit();

      expect(trackEvent).toHaveBeenCalledWith('agent_created', { agent_name: 'local-agent' });
    });

    it('does NOT call trackEvent when tenant already exists', async () => {
      mockTenantRepo.count.mockResolvedValue(1);

      await service.onModuleInit();

      expect(trackEvent).not.toHaveBeenCalled();
    });

    it('skips model pricing seed when models already exist', async () => {
      mockPricingRepo.count.mockResolvedValue(28);

      await service.onModuleInit();

      expect(mockPricingRepo.upsert).not.toHaveBeenCalled();
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

    it('registers API key when config file exists with apiKey', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { existsSync, readFileSync } = require('fs');
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
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { existsSync, readFileSync } = require('fs');
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({ apiKey: 'mnfst_test_key_12345' }),
      );
      mockAgentKeyRepo.count.mockResolvedValue(1);

      await service.onModuleInit();

      expect(mockAgentKeyRepo.upsert).not.toHaveBeenCalled();
    });

    it('reconciles API key even when tenant already exists', async () => {
      const { existsSync, readFileSync } = require('fs');
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

  describe('error handling', () => {
    it('handles background pricing sync failure gracefully', async () => {
      mockPricingSync.syncPricing.mockRejectedValue(new Error('network error'));

      await expect(service.onModuleInit()).resolves.not.toThrow();
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
});
