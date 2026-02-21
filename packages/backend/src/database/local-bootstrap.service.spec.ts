// Mock typeorm to avoid path-scurry native dependency issue
jest.mock('typeorm', () => ({
  DataSource: jest.fn(),
  Repository: jest.fn(),
}));

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

// Mock auth.instance before importing the service
jest.mock('../auth/auth.instance', () => ({
  auth: {
    $context: Promise.resolve({ runMigrations: jest.fn() }),
    api: {
      signUpEmail: jest.fn().mockResolvedValue({}),
    },
  },
}));

// Mock fs for config reading
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn(),
}));

// Mock pricing-sync to avoid deep import chain
jest.mock('./pricing-sync.service', () => ({
  PricingSyncService: jest.fn(),
}));

// Mock model-pricing-cache
jest.mock('../model-prices/model-pricing-cache.service', () => ({
  ModelPricingCacheService: jest.fn(),
}));

// Mock entity imports
jest.mock('../entities/tenant.entity', () => ({ Tenant: jest.fn() }));
jest.mock('../entities/agent.entity', () => ({ Agent: jest.fn() }));
jest.mock('../entities/agent-api-key.entity', () => ({ AgentApiKey: jest.fn() }));
jest.mock('../entities/model-pricing.entity', () => ({ ModelPricing: jest.fn() }));

import { LocalBootstrapService } from './local-bootstrap.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { auth } = require('../auth/auth.instance');

function makeMockRepo() {
  return {
    count: jest.fn().mockResolvedValue(0),
    insert: jest.fn().mockResolvedValue({}),
    upsert: jest.fn().mockResolvedValue({}),
  };
}

describe('LocalBootstrapService', () => {
  let service: LocalBootstrapService;
  let mockDataSource: { query: jest.Mock };
  let mockTenantRepo: ReturnType<typeof makeMockRepo>;
  let mockAgentRepo: ReturnType<typeof makeMockRepo>;
  let mockAgentKeyRepo: ReturnType<typeof makeMockRepo>;
  let mockPricingRepo: ReturnType<typeof makeMockRepo>;
  let mockPricingCache: { reload: jest.Mock };
  let mockPricingSync: { syncPricing: jest.Mock };

  beforeEach(() => {
    mockDataSource = { query: jest.fn() };
    mockTenantRepo = makeMockRepo();
    mockAgentRepo = makeMockRepo();
    mockAgentKeyRepo = makeMockRepo();
    mockPricingRepo = makeMockRepo();
    mockPricingCache = { reload: jest.fn().mockResolvedValue(undefined) };
    mockPricingSync = { syncPricing: jest.fn().mockResolvedValue(undefined) };

    (auth.api.signUpEmail as jest.Mock).mockClear();
    (auth.api.signUpEmail as jest.Mock).mockResolvedValue({});

    service = new LocalBootstrapService(
      mockDataSource as never,
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
      mockDataSource.query.mockResolvedValueOnce([]); // checkUserExists
      mockDataSource.query.mockResolvedValueOnce(undefined); // UPDATE emailVerified
      mockDataSource.query.mockResolvedValueOnce([{ id: 'ba-user-id' }]); // getBetterAuthUserId

      await service.onModuleInit();

      expect(mockPricingRepo.upsert).toHaveBeenCalled();
      expect(mockPricingCache.reload).toHaveBeenCalled();
      expect(mockTenantRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'local-tenant-001',
          name: 'ba-user-id',
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

    it('skips user creation when user already exists', async () => {
      mockDataSource.query.mockResolvedValueOnce([{ id: 'existing-id' }]);
      mockDataSource.query.mockResolvedValueOnce([{ id: 'existing-id' }]);

      await service.onModuleInit();

      expect(auth.api.signUpEmail).not.toHaveBeenCalled();
    });

    it('skips tenant/agent when tenant already exists', async () => {
      mockTenantRepo.count.mockResolvedValue(1);
      mockDataSource.query.mockResolvedValueOnce([]); // checkUserExists
      mockDataSource.query.mockResolvedValueOnce(undefined); // UPDATE email

      await service.onModuleInit();

      expect(mockTenantRepo.insert).not.toHaveBeenCalled();
      expect(mockAgentRepo.insert).not.toHaveBeenCalled();
    });

    it('skips model pricing seed when models already exist', async () => {
      mockPricingRepo.count.mockResolvedValue(28);
      mockDataSource.query.mockResolvedValueOnce([]); // checkUserExists
      mockDataSource.query.mockResolvedValueOnce(undefined); // UPDATE email
      mockDataSource.query.mockResolvedValueOnce([{ id: 'ba-id' }]); // getBetterAuthUserId

      await service.onModuleInit();

      expect(mockPricingRepo.upsert).not.toHaveBeenCalled();
    });

    it('skips tenant/agent when no user found in BetterAuth', async () => {
      mockDataSource.query.mockResolvedValueOnce([]); // checkUserExists
      mockDataSource.query.mockResolvedValueOnce(undefined); // UPDATE email
      mockDataSource.query.mockResolvedValueOnce([]); // getBetterAuthUserId empty

      await service.onModuleInit();

      expect(mockTenantRepo.insert).not.toHaveBeenCalled();
      expect(mockAgentRepo.insert).not.toHaveBeenCalled();
    });
  });

  describe('config reading', () => {
    it('does not register API key when config file missing', async () => {
      const { existsSync } = require('fs');
      (existsSync as jest.Mock).mockReturnValue(false);

      mockDataSource.query.mockResolvedValueOnce([]); // checkUserExists
      mockDataSource.query.mockResolvedValueOnce(undefined); // UPDATE email
      mockDataSource.query.mockResolvedValueOnce([{ id: 'ba-id' }]); // getBetterAuthUserId

      await service.onModuleInit();

      expect(mockAgentKeyRepo.insert).not.toHaveBeenCalled();
    });

    it('registers API key when config file exists with apiKey', async () => {
      const { existsSync, readFileSync } = require('fs');
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({ apiKey: 'mnfst_test_key_12345' }),
      );

      mockDataSource.query.mockResolvedValueOnce([]); // checkUserExists
      mockDataSource.query.mockResolvedValueOnce(undefined); // UPDATE email
      mockDataSource.query.mockResolvedValueOnce([{ id: 'ba-id' }]); // getBetterAuthUserId

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

      mockDataSource.query.mockResolvedValueOnce([]); // checkUserExists
      mockDataSource.query.mockResolvedValueOnce(undefined); // UPDATE email
      mockDataSource.query.mockResolvedValueOnce([{ id: 'ba-id' }]); // getBetterAuthUserId

      await service.onModuleInit();

      expect(mockAgentKeyRepo.insert).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('handles signUp failure gracefully', async () => {
      (auth.api.signUpEmail as jest.Mock).mockRejectedValueOnce(
        new Error('signup failed'),
      );
      mockDataSource.query.mockResolvedValueOnce([]); // checkUserExists
      mockDataSource.query.mockResolvedValueOnce([]); // getBetterAuthUserId

      await expect(service.onModuleInit()).resolves.not.toThrow();
    });

    it('handles background pricing sync failure gracefully', async () => {
      mockPricingSync.syncPricing.mockRejectedValue(new Error('network error'));
      mockDataSource.query.mockResolvedValueOnce([]); // checkUserExists
      mockDataSource.query.mockResolvedValueOnce(undefined); // UPDATE email
      mockDataSource.query.mockResolvedValueOnce([{ id: 'ba-id' }]); // getBetterAuthUserId

      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });
});
