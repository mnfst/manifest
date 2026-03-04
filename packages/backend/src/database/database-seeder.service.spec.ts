import { DatabaseSeederService } from './database-seeder.service';

// Mock auth.instance before importing the service
jest.mock('../auth/auth.instance', () => ({
  auth: {
    $context: Promise.resolve({ runMigrations: jest.fn() }),
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
  let mockPricingRepo: ReturnType<typeof makeMockRepo>;
  let mockPricingCache: { reload: jest.Mock };
  const originalManifestMode = process.env['MANIFEST_MODE'];

  beforeEach(() => {
    // Ensure local mode doesn't short-circuit onModuleInit (sql.js CI sets MANIFEST_MODE=local)
    delete process.env['MANIFEST_MODE'];
    mockPricingRepo = makeMockRepo();
    mockPricingCache = { reload: jest.fn().mockResolvedValue(undefined) };

    service = new DatabaseSeederService(mockPricingRepo as never, mockPricingCache as never);

    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalManifestMode !== undefined) {
      process.env['MANIFEST_MODE'] = originalManifestMode;
    } else {
      delete process.env['MANIFEST_MODE'];
    }
  });

  describe('onModuleInit', () => {
    it('should run Better Auth migrations', async () => {
      const ctx = await auth.$context;
      await service.onModuleInit();
      expect(ctx.runMigrations).toHaveBeenCalled();
    });

    it('should always seed model pricing', async () => {
      await service.onModuleInit();

      expect(mockPricingRepo.upsert).toHaveBeenCalled();
    });

    it('should skip initialization in local mode', async () => {
      process.env['MANIFEST_MODE'] = 'local';

      await service.onModuleInit();

      expect(mockPricingRepo.upsert).not.toHaveBeenCalled();
    });
  });

  describe('seedModelPricing', () => {
    it('should upsert all curated models (80 total)', async () => {
      await service.onModuleInit();

      expect(mockPricingRepo.upsert).toHaveBeenCalledTimes(80);
    });

    it('should upsert with model_name as conflict key', async () => {
      await service.onModuleInit();

      for (const call of mockPricingRepo.upsert.mock.calls) {
        expect(call[1]).toEqual(['model_name']);
      }
    });

    it('should reload pricing cache after seeding models', async () => {
      await service.onModuleInit();

      expect(mockPricingCache.reload).toHaveBeenCalled();
    });

    it('should not include quality_score in upsert (computed dynamically)', async () => {
      await service.onModuleInit();

      for (const call of mockPricingRepo.upsert.mock.calls) {
        expect(call[0]).not.toHaveProperty('quality_score');
      }
    });

    it('should include claude-opus-4-6 with correct pricing', async () => {
      await service.onModuleInit();

      expect(mockPricingRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          model_name: 'claude-opus-4-6',
          provider: 'Anthropic',
          input_price_per_token: 0.000015,
          output_price_per_token: 0.000075,
          context_window: 200000,
          capability_reasoning: true,
          capability_code: true,
        }),
        ['model_name'],
      );
    });
  });
});
