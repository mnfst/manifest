import { NotFoundException } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { ModelPricing } from '../entities/model-pricing.entity';
import { TierAssignment } from '../entities/tier-assignment.entity';
import { UserProvider } from '../entities/user-provider.entity';

function makeMockRepo() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue({}),
    save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
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

  /* ── getProviders ── */

  describe('getProviders', () => {
    it('should return all providers for a user', async () => {
      const providers = [
        { id: 'p1', user_id: 'u1', provider: 'openai', is_active: true },
        { id: 'p2', user_id: 'u1', provider: 'anthropic', is_active: false },
      ];
      mockProviderRepo.find.mockResolvedValue(providers);

      const result = await service.getProviders('u1');

      expect(mockProviderRepo.find).toHaveBeenCalledWith({ where: { user_id: 'u1' } });
      expect(result).toBe(providers);
    });

    it('should return empty array when user has no providers', async () => {
      mockProviderRepo.find.mockResolvedValue([]);

      const result = await service.getProviders('u1');
      expect(result).toEqual([]);
    });
  });

  /* ── upsertProvider ── */

  describe('upsertProvider', () => {
    it('should create a new provider when none exists', async () => {
      mockProviderRepo.findOne.mockResolvedValue(null);

      const result = await service.upsertProvider('u1', 'openai', 'enc-key');

      expect(mockProviderRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'u1',
          provider: 'openai',
          api_key_encrypted: 'enc-key',
          is_active: true,
        }),
      );
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('u1');
      expect(result.provider).toBe('openai');
      expect(result.is_active).toBe(true);
    });

    it('should update existing provider and reactivate it', async () => {
      const existing = Object.assign(new UserProvider(), {
        id: 'p1',
        user_id: 'u1',
        provider: 'openai',
        api_key_encrypted: 'old-key',
        is_active: false,
      });
      mockProviderRepo.findOne.mockResolvedValue(existing);

      const result = await service.upsertProvider('u1', 'openai', 'new-key');

      expect(mockProviderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          api_key_encrypted: 'new-key',
          is_active: true,
        }),
      );
      expect(mockProviderRepo.insert).not.toHaveBeenCalled();
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('u1');
      expect(result.api_key_encrypted).toBe('new-key');
      expect(result.is_active).toBe(true);
    });
  });

  /* ── removeProvider ── */

  describe('removeProvider', () => {
    it('should throw NotFoundException when provider does not exist', async () => {
      mockProviderRepo.findOne.mockResolvedValue(null);

      await expect(service.removeProvider('u1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should deactivate provider and recalculate', async () => {
      const existing = Object.assign(new UserProvider(), {
        id: 'p1',
        user_id: 'u1',
        provider: 'openai',
        is_active: true,
      });
      mockProviderRepo.findOne.mockResolvedValue(existing);
      mockTierRepo.find.mockResolvedValue([]); // no overrides

      const result = await service.removeProvider('u1', 'openai');

      expect(existing.is_active).toBe(false);
      expect(mockProviderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false }),
      );
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('u1');
      expect(result.notifications).toEqual([]);
    });

    it('should invalidate overrides belonging to the removed provider', async () => {
      const existing = Object.assign(new UserProvider(), {
        id: 'p1',
        user_id: 'u1',
        provider: 'openai',
        is_active: true,
      });
      mockProviderRepo.findOne.mockResolvedValue(existing);

      const override = Object.assign(new TierAssignment(), {
        user_id: 'u1',
        tier: 'complex',
        override_model: 'gpt-4o',
      });
      mockTierRepo.find
        .mockResolvedValueOnce([override]); // overrides query
      mockTierRepo.findOne.mockResolvedValue({
        auto_assigned_model: 'claude-opus-4-6',
      });

      mockPricingCache.getByModel.mockReturnValue({
        provider: 'OpenAI',
      } as ModelPricing);

      const result = await service.removeProvider('u1', 'openai');

      expect(override.override_model).toBeNull();
      expect(mockTierRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ override_model: null }),
      );
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]).toContain('gpt-4o');
      expect(result.notifications[0]).toContain('Complex');
      expect(result.notifications[0]).toContain('claude-opus-4-6');
    });

    it('should build notification without fallback model when auto is null', async () => {
      const existing = Object.assign(new UserProvider(), {
        id: 'p1',
        user_id: 'u1',
        provider: 'openai',
        is_active: true,
      });
      mockProviderRepo.findOne.mockResolvedValue(existing);

      const override = Object.assign(new TierAssignment(), {
        user_id: 'u1',
        tier: 'simple',
        override_model: 'gpt-4o',
      });
      mockTierRepo.find.mockResolvedValueOnce([override]);
      mockTierRepo.findOne.mockResolvedValue({
        auto_assigned_model: null,
      });
      mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' } as ModelPricing);

      const result = await service.removeProvider('u1', 'openai');

      expect(result.notifications[0]).toContain('automatic mode.');
      expect(result.notifications[0]).not.toContain('(');
    });

    it('should not invalidate overrides from other providers', async () => {
      const existing = Object.assign(new UserProvider(), {
        id: 'p1',
        user_id: 'u1',
        provider: 'openai',
        is_active: true,
      });
      mockProviderRepo.findOne.mockResolvedValue(existing);

      const override = Object.assign(new TierAssignment(), {
        user_id: 'u1',
        tier: 'complex',
        override_model: 'claude-opus-4-6',
      });
      mockTierRepo.find.mockResolvedValueOnce([override]);
      mockPricingCache.getByModel.mockReturnValue({
        provider: 'Anthropic',
      } as ModelPricing);

      const result = await service.removeProvider('u1', 'openai');

      expect(override.override_model).toBe('claude-opus-4-6'); // not cleared
      expect(result.notifications).toEqual([]);
    });
  });

  /* ── setOverride ── */

  describe('setOverride', () => {
    it('should update existing tier row', async () => {
      const existing = Object.assign(new TierAssignment(), {
        id: 't1',
        user_id: 'u1',
        tier: 'complex',
        override_model: null,
      });
      mockTierRepo.findOne.mockResolvedValue(existing);

      const result = await service.setOverride('u1', 'complex', 'claude-opus-4-6');

      expect(existing.override_model).toBe('claude-opus-4-6');
      expect(mockTierRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ override_model: 'claude-opus-4-6' }),
      );
      expect(result.override_model).toBe('claude-opus-4-6');
    });

    it('should create new tier row when none exists', async () => {
      mockTierRepo.findOne.mockResolvedValue(null);

      const result = await service.setOverride('u1', 'reasoning', 'o1-pro');

      expect(mockTierRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'u1',
          tier: 'reasoning',
          override_model: 'o1-pro',
          auto_assigned_model: null,
        }),
      );
      expect(result.override_model).toBe('o1-pro');
    });
  });

  /* ── clearOverride ── */

  describe('clearOverride', () => {
    it('should clear override on existing tier', async () => {
      const existing = Object.assign(new TierAssignment(), {
        id: 't1',
        user_id: 'u1',
        tier: 'simple',
        override_model: 'gpt-4o',
      });
      mockTierRepo.findOne.mockResolvedValue(existing);

      await service.clearOverride('u1', 'simple');

      expect(existing.override_model).toBeNull();
      expect(mockTierRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ override_model: null }),
      );
    });

    it('should be a no-op when tier does not exist', async () => {
      mockTierRepo.findOne.mockResolvedValue(null);

      await service.clearOverride('u1', 'nonexistent');

      expect(mockTierRepo.save).not.toHaveBeenCalled();
    });
  });

  /* ── resetAllOverrides ── */

  describe('resetAllOverrides', () => {
    it('should update all tiers for the user', async () => {
      await service.resetAllOverrides('u1');

      expect(mockTierRepo.update).toHaveBeenCalledWith(
        { user_id: 'u1' },
        expect.objectContaining({ override_model: null }),
      );
    });
  });

  /* ── invalidateOverridesForRemovedModels ── */

  describe('invalidateOverridesForRemovedModels', () => {
    it('should return early for empty array', async () => {
      await service.invalidateOverridesForRemovedModels([]);

      expect(mockTierRepo.find).not.toHaveBeenCalled();
    });

    it('should return early when no tiers are affected', async () => {
      mockTierRepo.find.mockResolvedValue([]);

      await service.invalidateOverridesForRemovedModels(['deleted-model']);

      expect(mockTierRepo.save).not.toHaveBeenCalled();
      expect(mockAutoAssign.recalculate).not.toHaveBeenCalled();
    });

    it('should clear overrides and recalculate for affected users', async () => {
      const tier1 = Object.assign(new TierAssignment(), {
        user_id: 'u1',
        tier: 'complex',
        override_model: 'old-model',
      });
      const tier2 = Object.assign(new TierAssignment(), {
        user_id: 'u2',
        tier: 'simple',
        override_model: 'old-model',
      });
      mockTierRepo.find.mockResolvedValue([tier1, tier2]);

      await service.invalidateOverridesForRemovedModels(['old-model']);

      expect(tier1.override_model).toBeNull();
      expect(tier2.override_model).toBeNull();
      expect(mockTierRepo.save).toHaveBeenCalledTimes(2);
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('u1');
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('u2');
    });

    it('should recalculate each user only once', async () => {
      const tier1 = Object.assign(new TierAssignment(), {
        user_id: 'u1',
        tier: 'complex',
        override_model: 'model-a',
      });
      const tier2 = Object.assign(new TierAssignment(), {
        user_id: 'u1',
        tier: 'simple',
        override_model: 'model-b',
      });
      mockTierRepo.find.mockResolvedValue([tier1, tier2]);

      await service.invalidateOverridesForRemovedModels(['model-a', 'model-b']);

      // Same user — should only recalculate once
      expect(mockAutoAssign.recalculate).toHaveBeenCalledTimes(1);
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('u1');
    });
  });
});
