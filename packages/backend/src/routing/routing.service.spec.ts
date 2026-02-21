import { RoutingService } from './routing.service';
import { ModelPricing } from '../entities/model-pricing.entity';
import { TierAssignment } from '../entities/tier-assignment.entity';

function makeMockRepo() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue({}),
    save: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  };
}

describe('RoutingService', () => {
  let service: RoutingService;
  let mockProviderRepo: ReturnType<typeof makeMockRepo>;
  let mockTierRepo: ReturnType<typeof makeMockRepo>;
  let mockAutoAssign: { recalculate: jest.Mock };
  let mockPricingCache: { getByModel: jest.Mock; getAll: jest.Mock };

  beforeEach(() => {
    mockProviderRepo = makeMockRepo();
    mockTierRepo = makeMockRepo();
    mockAutoAssign = { recalculate: jest.fn().mockResolvedValue(undefined) };
    mockPricingCache = {
      getByModel: jest.fn(),
      getAll: jest.fn().mockReturnValue([]),
    };

    service = new RoutingService(
      mockProviderRepo as never,
      mockTierRepo as never,
      mockAutoAssign as never,
      mockPricingCache as never,
    );
  });

  describe('getTiers (lazy init)', () => {
    it('should return existing rows when they exist', async () => {
      const rows = [
        { user_id: 'u1', tier: 'simple', override_model: null, auto_assigned_model: 'gpt-4o' },
      ];
      mockTierRepo.find.mockResolvedValue(rows);

      const result = await service.getTiers('u1');
      expect(result).toBe(rows);
      expect(mockTierRepo.insert).not.toHaveBeenCalled();
    });

    it('should create 4 tier rows when none exist', async () => {
      // First find returns empty (no rows), provider find also empty
      mockTierRepo.find.mockResolvedValueOnce([]);
      mockProviderRepo.find.mockResolvedValue([]);

      const result = await service.getTiers('u1');

      expect(mockTierRepo.insert).toHaveBeenCalledTimes(4);
      const tiers = mockTierRepo.insert.mock.calls.map(
        (c: unknown[]) => (c[0] as { tier: string }).tier,
      );
      expect(tiers).toEqual(['simple', 'standard', 'complex', 'reasoning']);
      expect(result).toHaveLength(4);
    });

    it('should recalculate and re-fetch when user has active providers', async () => {
      mockTierRepo.find
        .mockResolvedValueOnce([]) // initial: no rows
        .mockResolvedValueOnce([  // after recalculate
          { tier: 'simple', auto_assigned_model: 'gpt-4o' },
          { tier: 'standard', auto_assigned_model: 'gpt-4o' },
          { tier: 'complex', auto_assigned_model: 'gpt-4o' },
          { tier: 'reasoning', auto_assigned_model: 'gpt-4o' },
        ]);
      mockProviderRepo.find.mockResolvedValue([
        { provider: 'openai', is_active: true },
      ]);

      const result = await service.getTiers('u1');

      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('u1');
      expect(result).toHaveLength(4);
      expect(result[0].auto_assigned_model).toBe('gpt-4o');
    });

    it('should not recalculate when user has no active providers', async () => {
      mockTierRepo.find.mockResolvedValueOnce([]);
      mockProviderRepo.find.mockResolvedValue([]);

      await service.getTiers('u1');

      expect(mockAutoAssign.recalculate).not.toHaveBeenCalled();
    });
  });

  describe('getEffectiveModel', () => {
    it('should return override_model when provider is still connected', async () => {
      const assignment = {
        override_model: 'claude-opus-4-6',
        auto_assigned_model: 'gpt-4o',
      } as TierAssignment;

      mockPricingCache.getByModel.mockReturnValue({
        provider: 'Anthropic',
      } as ModelPricing);
      mockProviderRepo.findOne.mockResolvedValue({
        provider: 'anthropic',
        is_active: true,
      });

      const result = await service.getEffectiveModel('u1', assignment);
      expect(result).toBe('claude-opus-4-6');
    });

    it('should fall back to auto when provider is disconnected', async () => {
      const assignment = {
        override_model: 'claude-opus-4-6',
        auto_assigned_model: 'gpt-4o',
      } as TierAssignment;

      mockPricingCache.getByModel.mockReturnValue({
        provider: 'Anthropic',
      } as ModelPricing);
      mockProviderRepo.findOne.mockResolvedValue(null); // provider not found

      const result = await service.getEffectiveModel('u1', assignment);
      expect(result).toBe('gpt-4o');
    });

    it('should fall back to auto when model is unknown', async () => {
      const assignment = {
        override_model: 'unknown-model',
        auto_assigned_model: 'gpt-4o',
      } as TierAssignment;

      mockPricingCache.getByModel.mockReturnValue(undefined);

      const result = await service.getEffectiveModel('u1', assignment);
      expect(result).toBe('gpt-4o');
    });

    it('should return auto_assigned_model when no override', async () => {
      const assignment = {
        override_model: null,
        auto_assigned_model: 'gpt-4o',
      } as TierAssignment;

      const result = await service.getEffectiveModel('u1', assignment);
      expect(result).toBe('gpt-4o');
    });

    it('should return null when no override and no auto', async () => {
      const assignment = {
        override_model: null,
        auto_assigned_model: null,
      } as TierAssignment;

      const result = await service.getEffectiveModel('u1', assignment);
      expect(result).toBeNull();
    });
  });
});
