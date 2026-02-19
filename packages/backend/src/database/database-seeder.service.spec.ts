import { ConfigService } from '@nestjs/config';
import { DatabaseSeederService } from './database-seeder.service';
import { sha256, keyPrefix } from '../common/utils/hash.util';

// Mock auth.instance before importing the service
jest.mock('../auth/auth.instance', () => ({
  auth: {
    $context: Promise.resolve({ runMigrations: jest.fn() }),
    api: { signUpEmail: jest.fn() },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { auth } = require('../auth/auth.instance');

function makeMockRepo() {
  return {
    count: jest.fn().mockResolvedValue(0),
    insert: jest.fn().mockResolvedValue({}),
    upsert: jest.fn().mockResolvedValue({}),
  };
}

describe('DatabaseSeederService', () => {
  let service: DatabaseSeederService;
  let mockDataSource: { query: jest.Mock };
  let mockConfigService: { get: jest.Mock };
  let mockTenantRepo: ReturnType<typeof makeMockRepo>;
  let mockAgentRepo: ReturnType<typeof makeMockRepo>;
  let mockAgentKeyRepo: ReturnType<typeof makeMockRepo>;
  let mockApiKeyRepo: ReturnType<typeof makeMockRepo>;
  let mockPricingRepo: ReturnType<typeof makeMockRepo>;
  let mockSecurityRepo: ReturnType<typeof makeMockRepo>;
  const originalSeedData = process.env['SEED_DATA'];

  beforeEach(() => {
    mockDataSource = { query: jest.fn() };
    mockConfigService = { get: jest.fn() };
    mockTenantRepo = makeMockRepo();
    mockAgentRepo = makeMockRepo();
    mockAgentKeyRepo = makeMockRepo();
    mockApiKeyRepo = makeMockRepo();
    mockPricingRepo = makeMockRepo();
    mockSecurityRepo = makeMockRepo();

    service = new DatabaseSeederService(
      mockDataSource as never,
      mockConfigService as never,
      mockTenantRepo as never,
      mockAgentRepo as never,
      mockAgentKeyRepo as never,
      mockApiKeyRepo as never,
      mockPricingRepo as never,
      mockSecurityRepo as never,
    );

    jest.clearAllMocks();

    // Default: dev environment with SEED_DATA enabled
    mockConfigService.get.mockReturnValue('development');
    process.env['SEED_DATA'] = 'true';

    // Default: admin user exists
    mockDataSource.query.mockResolvedValue([{ id: 'admin-user-id' }]);
  });

  afterEach(() => {
    if (originalSeedData !== undefined) {
      process.env['SEED_DATA'] = originalSeedData;
    } else {
      delete process.env['SEED_DATA'];
    }
  });

  describe('onModuleInit', () => {
    it('should run Better Auth migrations', async () => {
      const ctx = await auth.$context;
      await service.onModuleInit();
      expect(ctx.runMigrations).toHaveBeenCalled();
    });

    it('should always seed model pricing', async () => {
      mockConfigService.get.mockReturnValue('production');
      delete process.env['SEED_DATA'];

      await service.onModuleInit();

      expect(mockPricingRepo.count).toHaveBeenCalled();
    });

    it('should seed demo data when env is development and SEED_DATA is true', async () => {
      mockConfigService.get.mockReturnValue('development');
      process.env['SEED_DATA'] = 'true';

      await service.onModuleInit();

      // seedApiKey was called
      expect(mockApiKeyRepo.count).toHaveBeenCalledWith({
        where: { id: 'seed-api-key-001' },
      });
      // seedTenantAndAgent was called
      expect(mockTenantRepo.count).toHaveBeenCalledWith({
        where: { id: 'seed-tenant-001' },
      });
    });

    it('should seed demo data when env is test and SEED_DATA is true', async () => {
      mockConfigService.get.mockReturnValue('test');
      process.env['SEED_DATA'] = 'true';

      await service.onModuleInit();

      expect(mockApiKeyRepo.count).toHaveBeenCalledWith({
        where: { id: 'seed-api-key-001' },
      });
    });

    it('should not seed demo data when env is production', async () => {
      mockConfigService.get.mockReturnValue('production');
      process.env['SEED_DATA'] = 'true';

      await service.onModuleInit();

      expect(mockApiKeyRepo.count).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'seed-api-key-001' } }),
      );
      expect(mockTenantRepo.count).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'seed-tenant-001' } }),
      );
    });

    it('should not seed demo data when SEED_DATA is not true', async () => {
      mockConfigService.get.mockReturnValue('development');
      delete process.env['SEED_DATA'];

      await service.onModuleInit();

      expect(mockApiKeyRepo.count).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'seed-api-key-001' } }),
      );
    });

    it('should not seed demo data when SEED_DATA is a non-true string', async () => {
      mockConfigService.get.mockReturnValue('development');
      process.env['SEED_DATA'] = 'false';

      await service.onModuleInit();

      expect(mockApiKeyRepo.count).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'seed-api-key-001' } }),
      );
    });
  });

  describe('seedApiKey', () => {
    it('should check idempotency by id, not by key value', async () => {
      await service.onModuleInit();

      expect(mockApiKeyRepo.count).toHaveBeenCalledWith({
        where: { id: 'seed-api-key-001' },
      });
    });

    it('should skip insert when api key already exists', async () => {
      mockApiKeyRepo.count.mockResolvedValue(1);

      await service.onModuleInit();

      expect(mockApiKeyRepo.insert).not.toHaveBeenCalled();
    });

    it('should store hashed key with null plaintext', async () => {
      mockApiKeyRepo.count.mockResolvedValue(0);

      await service.onModuleInit();

      expect(mockApiKeyRepo.insert).toHaveBeenCalledWith({
        id: 'seed-api-key-001',
        key: null,
        key_hash: sha256('dev-api-key-manifest-001'),
        key_prefix: keyPrefix('dev-api-key-manifest-001'),
        user_id: 'admin-user-id',
        name: 'Development API Key',
      });
    });

    it('should store the correct sha256 hash value', async () => {
      mockApiKeyRepo.count.mockResolvedValue(0);

      await service.onModuleInit();

      const insertCall = mockApiKeyRepo.insert.mock.calls[0][0];
      expect(insertCall.key_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(insertCall.key_hash).toBe(sha256('dev-api-key-manifest-001'));
    });

    it('should store the correct key prefix (first 12 chars)', async () => {
      mockApiKeyRepo.count.mockResolvedValue(0);

      await service.onModuleInit();

      const insertCall = mockApiKeyRepo.insert.mock.calls[0][0];
      expect(insertCall.key_prefix).toBe('dev-api-key-');
    });

    it('should skip insert when admin user is not found', async () => {
      mockApiKeyRepo.count.mockResolvedValue(0);
      mockDataSource.query.mockResolvedValue([]);

      await service.onModuleInit();

      expect(mockApiKeyRepo.insert).not.toHaveBeenCalled();
    });
  });

  describe('seedTenantAndAgent', () => {
    it('should check idempotency by tenant id', async () => {
      await service.onModuleInit();

      expect(mockTenantRepo.count).toHaveBeenCalledWith({
        where: { id: 'seed-tenant-001' },
      });
    });

    it('should skip all inserts when tenant already exists', async () => {
      mockTenantRepo.count.mockResolvedValue(1);

      await service.onModuleInit();

      expect(mockTenantRepo.insert).not.toHaveBeenCalled();
      expect(mockAgentRepo.insert).not.toHaveBeenCalled();
      expect(mockAgentKeyRepo.insert).not.toHaveBeenCalled();
    });

    it('should create tenant, agent, and agent api key when none exist', async () => {
      mockTenantRepo.count.mockResolvedValue(0);

      await service.onModuleInit();

      expect(mockTenantRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'seed-tenant-001',
          name: 'admin-user-id',
          email: 'admin@manifest.build',
          is_active: true,
        }),
      );
      expect(mockAgentRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'seed-agent-001',
          name: 'demo-agent',
          tenant_id: 'seed-tenant-001',
          is_active: true,
        }),
      );
      expect(mockAgentKeyRepo.insert).toHaveBeenCalled();
    });

    it('should store agent api key with hashed value and null plaintext', async () => {
      mockTenantRepo.count.mockResolvedValue(0);

      await service.onModuleInit();

      expect(mockAgentKeyRepo.insert).toHaveBeenCalledWith({
        id: 'seed-otlp-key-001',
        key: null,
        key_hash: sha256('mnfst_dev-otlp-key-001'),
        key_prefix: keyPrefix('mnfst_dev-otlp-key-001'),
        label: 'Demo OTLP ingest key',
        tenant_id: 'seed-tenant-001',
        agent_id: 'seed-agent-001',
        is_active: true,
      });
    });

    it('should store the correct OTLP key prefix', async () => {
      mockTenantRepo.count.mockResolvedValue(0);

      await service.onModuleInit();

      const insertCall = mockAgentKeyRepo.insert.mock.calls[0][0];
      expect(insertCall.key_prefix).toBe('mnfst_dev-ot');
    });

    it('should skip inserts when admin user is not found', async () => {
      mockTenantRepo.count.mockResolvedValue(0);
      mockDataSource.query.mockResolvedValue([]);

      await service.onModuleInit();

      expect(mockTenantRepo.insert).not.toHaveBeenCalled();
      expect(mockAgentRepo.insert).not.toHaveBeenCalled();
      expect(mockAgentKeyRepo.insert).not.toHaveBeenCalled();
    });
  });

  describe('seedModelPricing', () => {
    it('should skip seeding when pricing data already exists', async () => {
      mockPricingRepo.count.mockResolvedValue(10);

      await service.onModuleInit();

      expect(mockPricingRepo.upsert).not.toHaveBeenCalled();
    });

    it('should upsert all model pricing entries when table is empty', async () => {
      mockPricingRepo.count.mockResolvedValue(0);

      // Prevent demo data seeding to isolate pricing test
      mockConfigService.get.mockReturnValue('production');

      await service.onModuleInit();

      // The source has 29 models defined
      expect(mockPricingRepo.upsert).toHaveBeenCalledTimes(29);
    });

    it('should upsert with model_name as conflict key', async () => {
      mockPricingRepo.count.mockResolvedValue(0);
      mockConfigService.get.mockReturnValue('production');

      await service.onModuleInit();

      for (const call of mockPricingRepo.upsert.mock.calls) {
        expect(call[1]).toEqual(['model_name']);
      }
    });

    it('should include claude-opus-4-6 with correct pricing', async () => {
      mockPricingRepo.count.mockResolvedValue(0);
      mockConfigService.get.mockReturnValue('production');

      await service.onModuleInit();

      expect(mockPricingRepo.upsert).toHaveBeenCalledWith(
        {
          model_name: 'claude-opus-4-6',
          provider: 'Anthropic',
          input_price_per_token: 0.000015,
          output_price_per_token: 0.000075,
        },
        ['model_name'],
      );
    });
  });

  describe('seedAdminUser', () => {
    it('should skip creation when admin user already exists', async () => {
      // query returns a row (user exists)
      mockDataSource.query.mockResolvedValue([{ id: 'existing-id' }]);

      await service.onModuleInit();

      expect(auth.api.signUpEmail).not.toHaveBeenCalled();
    });

    it('should create admin user when not found', async () => {
      // First call (checkBetterAuthUser): no rows
      // Subsequent calls (getAdminUserId): return the user
      mockDataSource.query
        .mockResolvedValueOnce([])    // checkBetterAuthUser
        .mockResolvedValueOnce({})    // UPDATE emailVerified
        .mockResolvedValue([{ id: 'new-admin-id' }]); // getAdminUserId

      await service.onModuleInit();

      expect(auth.api.signUpEmail).toHaveBeenCalledWith({
        body: {
          email: 'admin@manifest.build',
          password: 'manifest',
          name: 'Admin',
        },
      });
    });

    it('should mark email as verified after creating admin user', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([])    // checkBetterAuthUser
        .mockResolvedValueOnce({})    // UPDATE emailVerified
        .mockResolvedValue([{ id: 'new-admin-id' }]);

      await service.onModuleInit();

      expect(mockDataSource.query).toHaveBeenCalledWith(
        `UPDATE "user" SET "emailVerified" = true WHERE email = $1`,
        ['admin@manifest.build'],
      );
    });
  });

  describe('seedSecurityEvents', () => {
    it('should skip seeding when events already exist', async () => {
      mockSecurityRepo.count.mockResolvedValue(5);

      await service.onModuleInit();

      expect(mockSecurityRepo.insert).not.toHaveBeenCalled();
    });

    it('should insert 12 security events when table is empty', async () => {
      mockSecurityRepo.count.mockResolvedValue(0);

      await service.onModuleInit();

      expect(mockSecurityRepo.insert).toHaveBeenCalledTimes(12);
    });

    it('should include events of all severity levels', async () => {
      mockSecurityRepo.count.mockResolvedValue(0);

      await service.onModuleInit();

      const insertedSeverities = mockSecurityRepo.insert.mock.calls.map(
        (call: unknown[]) => (call[0] as { severity: string }).severity,
      );
      expect(insertedSeverities).toContain('critical');
      expect(insertedSeverities).toContain('warning');
      expect(insertedSeverities).toContain('info');
    });

    it('should attach admin user_id to security events', async () => {
      mockSecurityRepo.count.mockResolvedValue(0);
      mockDataSource.query.mockResolvedValue([{ id: 'admin-user-id' }]);

      await service.onModuleInit();

      for (const call of mockSecurityRepo.insert.mock.calls) {
        expect((call[0] as { user_id: string }).user_id).toBe('admin-user-id');
      }
    });
  });

  describe('getAdminUserId edge cases', () => {
    it('should handle checkBetterAuthUser failure gracefully', async () => {
      // checkBetterAuthUser catches DB errors and returns false,
      // which causes seedAdminUser to proceed with signUpEmail.
      // The subsequent UPDATE query also needs a mock.
      mockDataSource.query
        .mockRejectedValueOnce(new Error('DB down'))  // checkBetterAuthUser
        .mockResolvedValueOnce({})                     // UPDATE emailVerified
        .mockResolvedValue([{ id: 'admin-id' }]);      // getAdminUserId calls

      await expect(service.onModuleInit()).resolves.toBeUndefined();
      // signUpEmail was called because checkBetterAuthUser returned false
      expect(auth.api.signUpEmail).toHaveBeenCalled();
    });

    it('should propagate unhandled errors from seedAdminUser', async () => {
      // checkBetterAuthUser returns false, signUpEmail throws
      mockDataSource.query.mockResolvedValueOnce([]);  // checkBetterAuthUser: no user
      auth.api.signUpEmail.mockRejectedValueOnce(new Error('signup failed'));

      await expect(service.onModuleInit()).rejects.toThrow('signup failed');
    });

    it('should skip api key insert when getAdminUserId returns null', async () => {
      // checkBetterAuthUser: user exists (skip signUpEmail)
      mockDataSource.query.mockResolvedValueOnce([{ id: 'x' }]);
      // getAdminUserId in seedApiKey: no rows
      mockDataSource.query.mockResolvedValueOnce([]);

      mockApiKeyRepo.count.mockResolvedValue(0);

      await service.onModuleInit();

      expect(mockApiKeyRepo.insert).not.toHaveBeenCalled();
    });
  });
});
