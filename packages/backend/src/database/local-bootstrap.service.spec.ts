// Mock typeorm to avoid path-scurry native dependency issue
jest.mock('typeorm', () => ({
  Repository: jest.fn(),
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

// Mock product-telemetry
jest.mock('../common/utils/product-telemetry', () => ({
  trackEvent: jest.fn(),
}));

// Mock entity imports
jest.mock('../entities/tenant.entity', () => ({ Tenant: jest.fn() }));
jest.mock('../entities/agent.entity', () => ({ Agent: jest.fn() }));
jest.mock('../entities/agent-api-key.entity', () => ({ AgentApiKey: jest.fn() }));
jest.mock('../entities/model-pricing.entity', () => ({ ModelPricing: jest.fn() }));

import { LocalBootstrapService } from './local-bootstrap.service';
import { trackEvent } from '../common/utils/product-telemetry';

function makeMockRepo() {
  return {
    count: jest.fn().mockResolvedValue(0),
    insert: jest.fn().mockResolvedValue({}),
    upsert: jest.fn().mockResolvedValue({}),
  };
}

describe('LocalBootstrapService', () => {
  let service: LocalBootstrapService;
  let mockTenantRepo: ReturnType<typeof makeMockRepo>;
  let mockAgentRepo: ReturnType<typeof makeMockRepo>;
  let mockAgentKeyRepo: ReturnType<typeof makeMockRepo>;
  let mockPricingRepo: ReturnType<typeof makeMockRepo>;
  let mockPricingCache: { reload: jest.Mock };
  let mockPricingSync: { syncPricing: jest.Mock };

  beforeEach(() => {
    mockTenantRepo = makeMockRepo();
    mockAgentRepo = makeMockRepo();
    mockAgentKeyRepo = makeMockRepo();
    mockPricingRepo = makeMockRepo();
    mockPricingCache = { reload: jest.fn().mockResolvedValue(undefined) };
    mockPricingSync = { syncPricing: jest.fn().mockResolvedValue(undefined) };

    (trackEvent as jest.Mock).mockClear();

    service = new LocalBootstrapService(
      mockTenantRepo as never,
      mockAgentRepo as never,
      mockAgentKeyRepo as never,
      mockPricingRepo as never,
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

    it('fires agent_created telemetry event when creating tenant/agent', async () => {
      await service.onModuleInit();

      expect(trackEvent).toHaveBeenCalledWith('agent_created');
    });

    it('does not fire agent_created when tenant already exists', async () => {
      mockTenantRepo.count.mockResolvedValue(1);

      await service.onModuleInit();

      expect(trackEvent).not.toHaveBeenCalledWith('agent_created');
    });

    it('skips tenant/agent when tenant already exists', async () => {
      mockTenantRepo.count.mockResolvedValue(1);

      await service.onModuleInit();

      expect(mockTenantRepo.insert).not.toHaveBeenCalled();
      expect(mockAgentRepo.insert).not.toHaveBeenCalled();
    });

    it('skips model pricing seed when models already exist', async () => {
      mockPricingRepo.count.mockResolvedValue(28);

      await service.onModuleInit();

      expect(mockPricingRepo.upsert).not.toHaveBeenCalled();
    });
  });

  describe('config reading', () => {
    it('does not register API key when config file missing', async () => {
      const { existsSync } = require('fs');
      (existsSync as jest.Mock).mockReturnValue(false);

      await service.onModuleInit();

      expect(mockAgentKeyRepo.insert).not.toHaveBeenCalled();
    });

    it('registers API key when config file exists with apiKey', async () => {
      const { existsSync, readFileSync } = require('fs');
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({ apiKey: 'mnfst_test_key_12345' }),
      );

      await service.onModuleInit();

      expect(mockAgentKeyRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'local-otlp-key-001',
          label: 'Local OTLP ingest key',
          tenant_id: 'local-tenant-001',
          agent_id: 'local-agent-001',
          is_active: true,
        }),
      );
    });

    it('skips API key registration when key hash already exists', async () => {
      const { existsSync, readFileSync } = require('fs');
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({ apiKey: 'mnfst_test_key_12345' }),
      );
      mockAgentKeyRepo.count.mockResolvedValue(1);

      await service.onModuleInit();

      expect(mockAgentKeyRepo.insert).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('handles background pricing sync failure gracefully', async () => {
      mockPricingSync.syncPricing.mockRejectedValue(new Error('network error'));

      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });
});
