import { NotFoundException } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { RoutingCacheService } from './routing-cache.service';
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
  let mockRoutingCache: RoutingCacheService;

  beforeEach(() => {
    process.env['BETTER_AUTH_SECRET'] = 'a'.repeat(32);
    mockProviderRepo = makeMockRepo();
    mockTierRepo = makeMockRepo();
    mockAutoAssign = { recalculate: jest.fn().mockResolvedValue(undefined) };
    mockPricingCache = {
      getByModel: jest.fn(),
      getAll: jest.fn().mockReturnValue([]),
    };
    mockRoutingCache = new RoutingCacheService();

    service = new RoutingService(
      mockProviderRepo as never,
      mockTierRepo as never,
      mockAutoAssign as never,
      mockPricingCache as never,
      mockRoutingCache,
    );
  });

  describe('getTiers (lazy init)', () => {
    it('should return cached tiers without hitting DB', async () => {
      const tiers = [
        { agent_id: 'a1', tier: 'simple', override_model: null, auto_assigned_model: 'gpt-4o' },
      ] as TierAssignment[];
      mockRoutingCache.setTiers('a1', tiers);

      const result = await service.getTiers('a1');

      expect(result).toEqual(tiers);
      expect(mockTierRepo.find).not.toHaveBeenCalled();
    });

    it('should return existing rows when they exist', async () => {
      const rows = [
        { agent_id: 'a1', tier: 'simple', override_model: null, auto_assigned_model: 'gpt-4o' },
      ];
      mockTierRepo.find.mockResolvedValue(rows);

      const result = await service.getTiers('a1');
      expect(result).toBe(rows);
      expect(mockTierRepo.insert).not.toHaveBeenCalled();
    });

    it('should create 4 tier rows when none exist', async () => {
      // First find returns empty (no rows), provider find also empty
      mockTierRepo.find.mockResolvedValueOnce([]);
      mockProviderRepo.find.mockResolvedValue([]);

      const result = await service.getTiers('a1');

      expect(mockTierRepo.insert).toHaveBeenCalledTimes(4);
      const tiers = mockTierRepo.insert.mock.calls.map(
        (c: unknown[]) => (c[0] as { tier: string }).tier,
      );
      expect(tiers).toEqual(['simple', 'standard', 'complex', 'reasoning']);
      expect(result).toHaveLength(4);
    });

    it('should recalculate and re-fetch when agent has active providers', async () => {
      mockTierRepo.find
        .mockResolvedValueOnce([]) // initial: no rows
        .mockResolvedValueOnce([
          // after recalculate
          { tier: 'simple', auto_assigned_model: 'gpt-4o' },
          { tier: 'standard', auto_assigned_model: 'gpt-4o' },
          { tier: 'complex', auto_assigned_model: 'gpt-4o' },
          { tier: 'reasoning', auto_assigned_model: 'gpt-4o' },
        ]);
      mockProviderRepo.find.mockResolvedValue([{ provider: 'openai', is_active: true }]);

      const result = await service.getTiers('a1');

      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('a1');
      expect(result).toHaveLength(4);
      expect(result[0].auto_assigned_model).toBe('gpt-4o');
    });

    it('should not recalculate when agent has no active providers', async () => {
      mockTierRepo.find.mockResolvedValueOnce([]);
      mockProviderRepo.find.mockResolvedValue([]);

      await service.getTiers('a1');

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
      mockProviderRepo.find.mockResolvedValue([{ provider: 'anthropic', is_active: true }]);

      const result = await service.getEffectiveModel('a1', assignment);
      expect(result).toBe('claude-opus-4-6');
    });

    it('should match provider case-insensitively', async () => {
      const assignment = {
        override_model: 'gpt-4o-mini',
        auto_assigned_model: 'gpt-oss-20b',
      } as TierAssignment;

      mockPricingCache.getByModel.mockReturnValue({
        provider: 'OpenAI',
      } as ModelPricing);
      // DB stores "OpenAI" with different case than pricing lowercase
      mockProviderRepo.find.mockResolvedValue([{ provider: 'OpenAI', is_active: true }]);

      const result = await service.getEffectiveModel('a1', assignment);
      expect(result).toBe('gpt-4o-mini');
    });

    it('should fall back to auto when provider is disconnected', async () => {
      const assignment = {
        override_model: 'claude-opus-4-6',
        auto_assigned_model: 'gpt-4o',
      } as TierAssignment;

      mockPricingCache.getByModel.mockReturnValue({
        provider: 'Anthropic',
      } as ModelPricing);
      mockProviderRepo.find.mockResolvedValue([]); // no active providers

      const result = await service.getEffectiveModel('a1', assignment);
      expect(result).toBe('gpt-4o');
    });

    it('should fall back to auto when model is unknown', async () => {
      const assignment = {
        override_model: 'unknown-model',
        auto_assigned_model: 'gpt-4o',
      } as TierAssignment;

      mockPricingCache.getByModel.mockReturnValue(undefined);

      const result = await service.getEffectiveModel('a1', assignment);
      expect(result).toBe('gpt-4o');
    });

    it('should match override via pricing model_name prefix (OpenRouter scenario)', async () => {
      const assignment = {
        override_model: 'anthropic/claude-sonnet-4',
        auto_assigned_model: 'gpt-4o',
      } as TierAssignment;

      // pricing.provider is "OpenRouter" (doesn't match), but model_name has "anthropic/" prefix
      mockPricingCache.getByModel.mockReturnValue({
        provider: 'OpenRouter',
        model_name: 'anthropic/claude-sonnet-4',
      } as ModelPricing);
      mockProviderRepo.find.mockResolvedValue([{ provider: 'anthropic', is_active: true }]);

      const result = await service.getEffectiveModel('a1', assignment);
      expect(result).toBe('anthropic/claude-sonnet-4');
    });

    it('should match override by model name prefix when no pricing entry', async () => {
      const assignment = {
        override_model: 'anthropic/claude-sonnet-4',
        auto_assigned_model: 'gpt-4o',
      } as TierAssignment;

      // No pricing entry — falls through to model name prefix extraction
      mockPricingCache.getByModel.mockReturnValue(undefined);
      mockProviderRepo.find.mockResolvedValue([{ provider: 'anthropic', is_active: true }]);

      const result = await service.getEffectiveModel('a1', assignment);
      expect(result).toBe('anthropic/claude-sonnet-4');
    });

    it('should return auto_assigned_model when no override', async () => {
      const assignment = {
        override_model: null,
        auto_assigned_model: 'gpt-4o',
      } as TierAssignment;

      const result = await service.getEffectiveModel('a1', assignment);
      expect(result).toBe('gpt-4o');
    });

    it('should return null when no override and no auto', async () => {
      const assignment = {
        override_model: null,
        auto_assigned_model: null,
      } as TierAssignment;

      const result = await service.getEffectiveModel('a1', assignment);
      expect(result).toBeNull();
    });
  });

  /* ── getProviders ── */

  describe('getProviders', () => {
    it('should return all providers for an agent', async () => {
      const providers = [
        { id: 'p1', agent_id: 'a1', provider: 'openai', is_active: true },
        { id: 'p2', agent_id: 'a1', provider: 'anthropic', is_active: false },
      ];
      mockProviderRepo.find.mockResolvedValue(providers);

      const result = await service.getProviders('a1');

      expect(mockProviderRepo.find).toHaveBeenCalledWith({ where: { agent_id: 'a1' } });
      expect(result).toBe(providers);
    });

    it('should return cached providers without hitting DB', async () => {
      const providers = [{ id: 'p1', agent_id: 'a1', provider: 'openai' }] as UserProvider[];
      mockRoutingCache.setProviders('a1', providers);

      const result = await service.getProviders('a1');

      expect(result).toEqual(providers);
      expect(mockProviderRepo.find).not.toHaveBeenCalled();
    });

    it('should return empty array when agent has no providers', async () => {
      mockProviderRepo.find.mockResolvedValue([]);

      const result = await service.getProviders('a1');
      expect(result).toEqual([]);
    });
  });

  /* ── upsertProvider ── */

  describe('upsertProvider', () => {
    it('should create a new provider when none exists (with apiKey)', async () => {
      mockProviderRepo.findOne.mockResolvedValue(null);

      const result = await service.upsertProvider('a1', 'u1', 'openai', 'enc-key');

      expect(mockProviderRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          agent_id: 'a1',
          user_id: 'u1',
          provider: 'openai',
          is_active: true,
        }),
      );
      const inserted = mockProviderRepo.insert.mock.calls[0][0];
      expect(inserted.api_key_encrypted).not.toBe('enc-key');
      expect(inserted.api_key_encrypted).toContain(':');
      expect(inserted.key_prefix).toBe('enc-key');
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('a1');
      expect(result.provider.provider).toBe('openai');
      expect(result.provider.is_active).toBe(true);
      expect(result.isNew).toBe(true);
    });

    it('should create a new provider without apiKey (null encrypted)', async () => {
      mockProviderRepo.findOne.mockResolvedValue(null);

      const result = await service.upsertProvider('a1', 'u1', 'openai');

      const inserted = mockProviderRepo.insert.mock.calls[0][0];
      expect(inserted.api_key_encrypted).toBeNull();
      expect(inserted.key_prefix).toBeNull();
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('a1');
      expect(result.provider.provider).toBe('openai');
      expect(result.provider.is_active).toBe(true);
      expect(result.isNew).toBe(true);
    });

    it('should update existing provider and reactivate it', async () => {
      const existing = Object.assign(new UserProvider(), {
        id: 'p1',
        user_id: 'u1',
        agent_id: 'a1',
        provider: 'openai',
        api_key_encrypted: 'old-key',
        key_prefix: 'old-key-',
        is_active: false,
      });
      mockProviderRepo.findOne.mockResolvedValue(existing);

      const result = await service.upsertProvider('a1', 'u1', 'openai', 'new-key');

      expect(mockProviderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: true,
        }),
      );
      const saved = mockProviderRepo.save.mock.calls[0][0];
      expect(saved.api_key_encrypted).not.toBe('new-key');
      expect(saved.api_key_encrypted).toContain(':');
      expect(saved.key_prefix).toBe('new-key');
      expect(mockProviderRepo.insert).not.toHaveBeenCalled();
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('a1');
      expect(result.provider.api_key_encrypted).toContain(':');
      expect(result.provider.is_active).toBe(true);
      expect(result.isNew).toBe(false);
    });

    it('should reactivate existing provider without changing key when no apiKey', async () => {
      const existing = Object.assign(new UserProvider(), {
        id: 'p1',
        user_id: 'u1',
        agent_id: 'a1',
        provider: 'openai',
        api_key_encrypted: 'old-encrypted',
        key_prefix: 'old-pref',
        is_active: false,
      });
      mockProviderRepo.findOne.mockResolvedValue(existing);

      const result = await service.upsertProvider('a1', 'u1', 'openai');

      expect(result.provider.is_active).toBe(true);
      expect(result.provider.api_key_encrypted).toBe('old-encrypted');
      expect(result.provider.key_prefix).toBe('old-pref');
      expect(result.isNew).toBe(false);
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('a1');
    });

    it('should return object with exactly provider and isNew keys', async () => {
      mockProviderRepo.findOne.mockResolvedValue(null);

      const result = await service.upsertProvider('a1', 'u1', 'openai', 'key');

      expect(Object.keys(result).sort()).toEqual(['isNew', 'provider']);
      expect(result.provider).toBeDefined();
      expect(typeof result.isNew).toBe('boolean');
    });

    it('should set connected_at and updated_at on new provider', async () => {
      mockProviderRepo.findOne.mockResolvedValue(null);

      const before = new Date().toISOString();
      const result = await service.upsertProvider('a1', 'u1', 'openai', 'key');
      const after = new Date().toISOString();

      const inserted = mockProviderRepo.insert.mock.calls[0][0];
      expect(inserted.connected_at).toBeDefined();
      expect(inserted.updated_at).toBeDefined();
      expect(inserted.connected_at >= before).toBe(true);
      expect(inserted.connected_at <= after).toBe(true);
      expect(inserted.updated_at >= before).toBe(true);
      expect(inserted.updated_at <= after).toBe(true);
      expect(result.provider.connected_at).toBe(inserted.connected_at);
    });

    it('should update updated_at but preserve connected_at on existing provider', async () => {
      const originalConnectedAt = '2025-01-01T00:00:00.000Z';
      const existing = Object.assign(new UserProvider(), {
        id: 'p1',
        user_id: 'u1',
        agent_id: 'a1',
        provider: 'openai',
        api_key_encrypted: 'old-encrypted',
        is_active: false,
        connected_at: originalConnectedAt,
        updated_at: '2025-01-01T00:00:00.000Z',
      });
      mockProviderRepo.findOne.mockResolvedValue(existing);

      const before = new Date().toISOString();
      await service.upsertProvider('a1', 'u1', 'openai', 'new-key');

      const saved = mockProviderRepo.save.mock.calls[0][0];
      expect(saved.connected_at).toBe(originalConnectedAt);
      expect(saved.updated_at >= before).toBe(true);
    });

    it('should store encrypted key for subscription provider with apiKey', async () => {
      mockProviderRepo.findOne.mockResolvedValue(null);

      const result = await service.upsertProvider(
        'a1',
        'u1',
        'anthropic',
        'setup-token-value',
        'subscription',
      );

      const inserted = mockProviderRepo.insert.mock.calls[0][0];
      expect(inserted.auth_type).toBe('subscription');
      expect(inserted.api_key_encrypted).toContain(':');
      expect(inserted.key_prefix).toBe('setup-to');
      expect(result.isNew).toBe(true);
    });

    it('should create subscription provider without apiKey (null encrypted)', async () => {
      mockProviderRepo.findOne.mockResolvedValue(null);

      const result = await service.upsertProvider(
        'a1',
        'u1',
        'anthropic',
        undefined,
        'subscription',
      );

      const inserted = mockProviderRepo.insert.mock.calls[0][0];
      expect(inserted.auth_type).toBe('subscription');
      expect(inserted.api_key_encrypted).toBeNull();
      expect(inserted.key_prefix).toBeNull();
      expect(result.isNew).toBe(true);
    });

    it('should store token when updating existing subscription provider with apiKey', async () => {
      const existing = Object.assign(new UserProvider(), {
        id: 'p1',
        user_id: 'u1',
        agent_id: 'a1',
        provider: 'anthropic',
        auth_type: 'subscription',
        api_key_encrypted: null,
        key_prefix: null,
        is_active: true,
      });
      mockProviderRepo.findOne.mockResolvedValue(existing);

      const result = await service.upsertProvider(
        'a1',
        'u1',
        'anthropic',
        'new-setup-token',
        'subscription',
      );

      expect(result.provider.auth_type).toBe('subscription');
      expect(result.provider.api_key_encrypted).toContain(':');
      expect(result.provider.key_prefix).toBe('new-setu');
      expect(result.isNew).toBe(false);
    });

    it('should generate a UUID id for new provider', async () => {
      mockProviderRepo.findOne.mockResolvedValue(null);

      await service.upsertProvider('a1', 'u1', 'openai', 'key');

      const inserted = mockProviderRepo.insert.mock.calls[0][0];
      expect(inserted.id).toBeDefined();
      expect(typeof inserted.id).toBe('string');
      // UUID v4 format: 8-4-4-4-12
      expect(inserted.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  /* ── removeProvider ── */

  describe('removeProvider', () => {
    it('should throw NotFoundException when provider does not exist', async () => {
      mockProviderRepo.findOne.mockResolvedValue(null);

      await expect(service.removeProvider('a1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should deactivate provider and recalculate', async () => {
      const existing = Object.assign(new UserProvider(), {
        id: 'p1',
        agent_id: 'a1',
        provider: 'openai',
        is_active: true,
      });
      mockProviderRepo.findOne
        .mockResolvedValueOnce(existing) // find the record
        .mockResolvedValueOnce(null); // no other active record
      mockTierRepo.find.mockResolvedValue([]); // no overrides

      const result = await service.removeProvider('a1', 'openai');

      expect(existing.is_active).toBe(false);
      expect(mockProviderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false }),
      );
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('a1');
      expect(result.notifications).toEqual([]);
    });

    it('should skip override clearing when another auth type is still active', async () => {
      const existing = Object.assign(new UserProvider(), {
        id: 'p1',
        agent_id: 'a1',
        provider: 'anthropic',
        auth_type: 'subscription',
        is_active: true,
      });
      const otherActive = Object.assign(new UserProvider(), {
        id: 'p2',
        agent_id: 'a1',
        provider: 'anthropic',
        auth_type: 'api_key',
        is_active: true,
      });
      mockProviderRepo.findOne
        .mockResolvedValueOnce(existing) // find the subscription record
        .mockResolvedValueOnce(otherActive); // api_key record still active

      const result = await service.removeProvider('a1', 'anthropic', 'subscription');

      expect(existing.is_active).toBe(false);
      expect(mockAutoAssign.recalculate).not.toHaveBeenCalled();
      expect(mockTierRepo.find).not.toHaveBeenCalled();
      expect(result.notifications).toEqual([]);
    });

    it('should invalidate overrides belonging to the removed provider', async () => {
      const existing = Object.assign(new UserProvider(), {
        id: 'p1',
        agent_id: 'a1',
        provider: 'openai',
        is_active: true,
      });
      mockProviderRepo.findOne
        .mockResolvedValueOnce(existing) // find the record
        .mockResolvedValueOnce(null); // no other active record

      const override = Object.assign(new TierAssignment(), {
        agent_id: 'a1',
        tier: 'complex',
        override_model: 'gpt-4o',
      });
      mockTierRepo.find.mockResolvedValueOnce([override]); // overrides query
      mockTierRepo.findOne.mockResolvedValue({
        auto_assigned_model: 'claude-opus-4-6',
      });

      mockPricingCache.getByModel.mockReturnValue({
        provider: 'OpenAI',
      } as ModelPricing);

      const result = await service.removeProvider('a1', 'openai');

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
        agent_id: 'a1',
        provider: 'openai',
        is_active: true,
      });
      mockProviderRepo.findOne.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);

      const override = Object.assign(new TierAssignment(), {
        agent_id: 'a1',
        tier: 'simple',
        override_model: 'gpt-4o',
      });
      mockTierRepo.find.mockResolvedValueOnce([override]);
      mockTierRepo.findOne.mockResolvedValue({
        auto_assigned_model: null,
      });
      mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' } as ModelPricing);

      const result = await service.removeProvider('a1', 'openai');

      expect(result.notifications[0]).toContain('automatic mode.');
      expect(result.notifications[0]).not.toContain('(');
    });

    it('should use raw tier name when tier is not in TIER_LABELS', async () => {
      const existing = Object.assign(new UserProvider(), {
        id: 'p1',
        agent_id: 'a1',
        provider: 'openai',
        is_active: true,
      });
      mockProviderRepo.findOne.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);

      const override = Object.assign(new TierAssignment(), {
        agent_id: 'a1',
        tier: 'custom_tier',
        override_model: 'gpt-4o',
      });
      mockTierRepo.find.mockResolvedValueOnce([override]);
      mockTierRepo.findOne.mockResolvedValue({
        auto_assigned_model: null,
      });
      mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' } as ModelPricing);

      const result = await service.removeProvider('a1', 'openai');

      // Since 'custom_tier' is not in TIER_LABELS, the raw tier name should be used
      expect(result.notifications[0]).toContain('custom_tier');
      expect(result.notifications[0]).toContain('automatic mode.');
    });

    it('should clean fallback models belonging to the removed provider', async () => {
      const existing = Object.assign(new UserProvider(), {
        id: 'p1',
        agent_id: 'a1',
        provider: 'openai',
        is_active: true,
      });
      mockProviderRepo.findOne
        .mockResolvedValueOnce(existing) // existing lookup
        .mockResolvedValueOnce(null); // otherActive check
      mockTierRepo.find
        .mockResolvedValueOnce([]) // overrides query
        .mockResolvedValueOnce([
          // allTiers query for fallback cleanup
          Object.assign(new TierAssignment(), {
            agent_id: 'a1',
            tier: 'standard',
            fallback_models: ['gpt-4o', 'claude-sonnet-4'],
          }),
        ]);
      mockPricingCache.getByModel
        .mockReturnValueOnce({ provider: 'OpenAI' }) // gpt-4o belongs to OpenAI
        .mockReturnValueOnce({ provider: 'Anthropic' }); // claude-sonnet-4 does not

      await service.removeProvider('a1', 'openai');

      // The save for fallback cleanup should have only claude-sonnet-4
      const fallbackSaveCall = mockTierRepo.save.mock.calls.find(
        (c: unknown[]) => (c[0] as { fallback_models?: string[] }).fallback_models !== undefined,
      );
      expect(fallbackSaveCall).toBeDefined();
      expect(
        (fallbackSaveCall![0] as { fallback_models: string[] | null }).fallback_models,
      ).toEqual(['claude-sonnet-4']);
    });

    it('should skip tiers with null or empty fallback_models during cleanup', async () => {
      const existing = Object.assign(new UserProvider(), {
        id: 'p1',
        agent_id: 'a1',
        provider: 'openai',
        is_active: true,
      });
      mockProviderRepo.findOne.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);
      mockTierRepo.find
        .mockResolvedValueOnce([]) // overrides query
        .mockResolvedValueOnce([
          // allTiers query for fallback cleanup
          Object.assign(new TierAssignment(), {
            agent_id: 'a1',
            tier: 'simple',
            fallback_models: null, // null — should be skipped (line 115)
          }),
          Object.assign(new TierAssignment(), {
            agent_id: 'a1',
            tier: 'complex',
            fallback_models: [], // empty — should be skipped (line 115)
          }),
          Object.assign(new TierAssignment(), {
            agent_id: 'a1',
            tier: 'standard',
            fallback_models: ['gpt-4o', 'claude-sonnet-4'],
          }),
        ]);
      mockPricingCache.getByModel
        .mockReturnValueOnce({ provider: 'OpenAI' }) // gpt-4o belongs to OpenAI
        .mockReturnValueOnce({ provider: 'Anthropic' }); // claude-sonnet-4 does not

      await service.removeProvider('a1', 'openai');

      // Only the standard tier (with actual fallback_models) should be saved
      const fallbackSaveCall = mockTierRepo.save.mock.calls.find(
        (c: unknown[]) => (c[0] as { fallback_models?: string[] }).fallback_models !== undefined,
      );
      expect(fallbackSaveCall).toBeDefined();
      expect(
        (fallbackSaveCall![0] as { fallback_models: string[] | null }).fallback_models,
      ).toEqual(['claude-sonnet-4']);
    });

    it('should set fallback_models to null when all belong to removed provider', async () => {
      const existing = Object.assign(new UserProvider(), {
        id: 'p1',
        agent_id: 'a1',
        provider: 'openai',
        is_active: true,
      });
      mockProviderRepo.findOne.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);
      mockTierRepo.find
        .mockResolvedValueOnce([]) // overrides query
        .mockResolvedValueOnce([
          Object.assign(new TierAssignment(), {
            agent_id: 'a1',
            tier: 'standard',
            fallback_models: ['gpt-4o', 'gpt-4o-mini'],
          }),
        ]);
      // Both models belong to OpenAI
      mockPricingCache.getByModel
        .mockReturnValueOnce({ provider: 'OpenAI' })
        .mockReturnValueOnce({ provider: 'OpenAI' });

      await service.removeProvider('a1', 'openai');

      // All fallbacks removed → fallback_models set to null (line 121)
      const fallbackSaveCall = mockTierRepo.save.mock.calls.find(
        (c: unknown[]) => 'fallback_models' in (c[0] as Record<string, unknown>),
      );
      expect(fallbackSaveCall).toBeDefined();
      expect(
        (fallbackSaveCall![0] as { fallback_models: string[] | null }).fallback_models,
      ).toBeNull();
    });

    it('should clean fallback models and overrides when subscription auth removed and no other active record', async () => {
      const existing = Object.assign(new UserProvider(), {
        id: 'p1',
        agent_id: 'a1',
        provider: 'anthropic',
        auth_type: 'subscription',
        is_active: true,
      });
      mockProviderRepo.findOne
        .mockResolvedValueOnce(existing) // find the subscription record
        .mockResolvedValueOnce(null); // no other active record for anthropic

      const override = Object.assign(new TierAssignment(), {
        agent_id: 'a1',
        tier: 'complex',
        override_model: 'claude-sonnet-4',
      });
      mockTierRepo.find
        .mockResolvedValueOnce([override]) // overrides query
        .mockResolvedValueOnce([
          // allTiers query for fallback cleanup
          Object.assign(new TierAssignment(), {
            agent_id: 'a1',
            tier: 'standard',
            fallback_models: ['claude-sonnet-4', 'gpt-4o'],
          }),
        ]);
      mockPricingCache.getByModel
        .mockReturnValueOnce({ provider: 'Anthropic' } as ModelPricing) // override check
        .mockReturnValueOnce({ provider: 'Anthropic' } as ModelPricing) // fallback: claude
        .mockReturnValueOnce({ provider: 'OpenAI' } as ModelPricing); // fallback: gpt-4o
      mockTierRepo.findOne.mockResolvedValue({ auto_assigned_model: 'gpt-4o' });

      const result = await service.removeProvider('a1', 'anthropic', 'subscription');

      // Override should be cleared
      expect(override.override_model).toBeNull();
      // Fallback should only contain gpt-4o (claude-sonnet-4 removed)
      const fallbackSaveCall = mockTierRepo.save.mock.calls.find((c: unknown[]) => {
        const item = c[0] as { fallback_models?: string[] };
        return item.fallback_models !== undefined && item.fallback_models !== null;
      });
      expect(fallbackSaveCall).toBeDefined();
      expect(
        (fallbackSaveCall![0] as { fallback_models: string[] | null }).fallback_models,
      ).toEqual(['gpt-4o']);
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]).toContain('claude-sonnet-4');
    });

    it('should pass authType to findOne when provided', async () => {
      const existing = Object.assign(new UserProvider(), {
        id: 'p1',
        agent_id: 'a1',
        provider: 'anthropic',
        auth_type: 'api_key',
        is_active: true,
      });
      mockProviderRepo.findOne.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);
      mockTierRepo.find.mockResolvedValue([]);

      await service.removeProvider('a1', 'anthropic', 'api_key');

      expect(mockProviderRepo.findOne).toHaveBeenNthCalledWith(1, {
        where: { agent_id: 'a1', provider: 'anthropic', auth_type: 'api_key' },
      });
    });

    it('should not invalidate overrides from other providers', async () => {
      const existing = Object.assign(new UserProvider(), {
        id: 'p1',
        agent_id: 'a1',
        provider: 'openai',
        is_active: true,
      });
      mockProviderRepo.findOne.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);

      const override = Object.assign(new TierAssignment(), {
        agent_id: 'a1',
        tier: 'complex',
        override_model: 'claude-opus-4-6',
      });
      mockTierRepo.find.mockResolvedValueOnce([override]);
      mockPricingCache.getByModel.mockReturnValue({
        provider: 'Anthropic',
      } as ModelPricing);

      const result = await service.removeProvider('a1', 'openai');

      expect(override.override_model).toBe('claude-opus-4-6'); // not cleared
      expect(result.notifications).toEqual([]);
    });
  });

  /* ── setOverride ── */

  describe('setOverride', () => {
    it('should update existing tier row', async () => {
      const existing = Object.assign(new TierAssignment(), {
        id: 't1',
        agent_id: 'a1',
        tier: 'complex',
        override_model: null,
      });
      mockTierRepo.findOne.mockResolvedValue(existing);

      const result = await service.setOverride('a1', 'u1', 'complex', 'claude-opus-4-6');

      expect(existing.override_model).toBe('claude-opus-4-6');
      expect(mockTierRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ override_model: 'claude-opus-4-6' }),
      );
      expect(result.override_model).toBe('claude-opus-4-6');
    });

    it('should store override_auth_type when authType is provided', async () => {
      const existing = Object.assign(new TierAssignment(), {
        id: 't1',
        agent_id: 'a1',
        tier: 'complex',
        override_model: null,
        override_auth_type: null,
      });
      mockTierRepo.findOne.mockResolvedValue(existing);

      const result = await service.setOverride(
        'a1',
        'u1',
        'complex',
        'claude-sonnet-4',
        'subscription',
      );

      expect(result.override_model).toBe('claude-sonnet-4');
      expect(result.override_auth_type).toBe('subscription');
      expect(mockTierRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          override_model: 'claude-sonnet-4',
          override_auth_type: 'subscription',
        }),
      );
    });

    it('should set override_auth_type to null when authType is not provided', async () => {
      const existing = Object.assign(new TierAssignment(), {
        id: 't1',
        agent_id: 'a1',
        tier: 'complex',
        override_model: 'old-model',
        override_auth_type: 'subscription',
      });
      mockTierRepo.findOne.mockResolvedValue(existing);

      const result = await service.setOverride('a1', 'u1', 'complex', 'gpt-4o');

      expect(result.override_model).toBe('gpt-4o');
      expect(result.override_auth_type).toBeNull();
    });

    it('should create new tier row when none exists', async () => {
      mockTierRepo.findOne.mockResolvedValue(null);

      const result = await service.setOverride('a1', 'u1', 'reasoning', 'o1-pro');

      expect(mockTierRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          agent_id: 'a1',
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
        agent_id: 'a1',
        tier: 'simple',
        override_model: 'gpt-4o',
      });
      mockTierRepo.findOne.mockResolvedValue(existing);

      await service.clearOverride('a1', 'simple');

      expect(existing.override_model).toBeNull();
      expect(mockTierRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ override_model: null }),
      );
    });

    it('should be a no-op when tier does not exist', async () => {
      mockTierRepo.findOne.mockResolvedValue(null);

      await service.clearOverride('a1', 'nonexistent');

      expect(mockTierRepo.save).not.toHaveBeenCalled();
    });
  });

  /* ── resetAllOverrides ── */

  describe('resetAllOverrides', () => {
    it('should update all tiers for the agent', async () => {
      await service.resetAllOverrides('a1');

      expect(mockTierRepo.update).toHaveBeenCalledWith(
        { agent_id: 'a1' },
        expect.objectContaining({ override_model: null, fallback_models: null }),
      );
    });
  });

  /* ── deactivateAllProviders ── */

  describe('deactivateAllProviders', () => {
    it('should deactivate all providers, clear overrides, and recalculate', async () => {
      await service.deactivateAllProviders('a1');

      expect(mockProviderRepo.update).toHaveBeenCalledWith(
        { agent_id: 'a1' },
        expect.objectContaining({ is_active: false }),
      );
      expect(mockTierRepo.update).toHaveBeenCalledWith(
        { agent_id: 'a1' },
        expect.objectContaining({ override_model: null, fallback_models: null }),
      );
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('a1');
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

    it('should clear overrides and recalculate for affected agents', async () => {
      const tier1 = Object.assign(new TierAssignment(), {
        agent_id: 'a1',
        tier: 'complex',
        override_model: 'old-model',
      });
      const tier2 = Object.assign(new TierAssignment(), {
        agent_id: 'a2',
        tier: 'simple',
        override_model: 'old-model',
      });
      mockTierRepo.find.mockResolvedValue([tier1, tier2]);

      await service.invalidateOverridesForRemovedModels(['old-model']);

      expect(tier1.override_model).toBeNull();
      expect(tier2.override_model).toBeNull();
      expect(mockTierRepo.save).toHaveBeenCalledTimes(2);
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('a1');
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('a2');
    });

    it('should clean fallback models referencing removed models', async () => {
      // First find: no overrides affected
      mockTierRepo.find
        .mockResolvedValueOnce([])
        // Second find: allTiers with fallback_models containing removed model
        .mockResolvedValueOnce([
          Object.assign(new TierAssignment(), {
            agent_id: 'a1',
            tier: 'standard',
            fallback_models: ['old-model', 'keep-model'],
          }),
        ]);

      await service.invalidateOverridesForRemovedModels(['old-model']);

      // Should save with only the kept model
      expect(mockTierRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ fallback_models: ['keep-model'] }),
      );
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('a1');
    });

    it('should set fallback_models to null when all fallbacks are removed', async () => {
      mockTierRepo.find
        .mockResolvedValueOnce([]) // no overrides
        .mockResolvedValueOnce([
          Object.assign(new TierAssignment(), {
            agent_id: 'a1',
            tier: 'simple',
            fallback_models: ['removed-model'],
          }),
        ]);

      await service.invalidateOverridesForRemovedModels(['removed-model']);

      expect(mockTierRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ fallback_models: null }),
      );
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('a1');
    });

    it('should recalculate each agent only once', async () => {
      const tier1 = Object.assign(new TierAssignment(), {
        agent_id: 'a1',
        tier: 'complex',
        override_model: 'model-a',
      });
      const tier2 = Object.assign(new TierAssignment(), {
        agent_id: 'a1',
        tier: 'simple',
        override_model: 'model-b',
      });
      mockTierRepo.find.mockResolvedValue([tier1, tier2]);

      await service.invalidateOverridesForRemovedModels(['model-a', 'model-b']);

      // Same agent — should only recalculate once
      expect(mockAutoAssign.recalculate).toHaveBeenCalledTimes(1);
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('a1');
    });
  });

  /* ── getFallbacks ── */

  describe('getFallbacks', () => {
    it('should return fallback_models when tier exists', async () => {
      mockTierRepo.findOne.mockResolvedValue({ fallback_models: ['model-a', 'model-b'] });
      const result = await service.getFallbacks('a1', 'standard');
      expect(result).toEqual(['model-a', 'model-b']);
    });

    it('should return empty array when tier has no fallbacks', async () => {
      mockTierRepo.findOne.mockResolvedValue({ fallback_models: null });
      const result = await service.getFallbacks('a1', 'standard');
      expect(result).toEqual([]);
    });

    it('should return empty array when tier does not exist', async () => {
      mockTierRepo.findOne.mockResolvedValue(null);
      const result = await service.getFallbacks('a1', 'nonexistent');
      expect(result).toEqual([]);
    });
  });

  /* ── setFallbacks ── */

  describe('setFallbacks', () => {
    it('should set fallback_models on existing tier', async () => {
      const existing = { agent_id: 'a1', tier: 'standard', fallback_models: null };
      mockTierRepo.findOne.mockResolvedValue(existing);
      const result = await service.setFallbacks('a1', 'standard', ['model-a']);
      expect(existing.fallback_models).toEqual(['model-a']);
      expect(mockTierRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ fallback_models: ['model-a'] }),
      );
      expect(result).toEqual(['model-a']);
    });

    it('should return empty array when tier does not exist', async () => {
      mockTierRepo.findOne.mockResolvedValue(null);
      const result = await service.setFallbacks('a1', 'nonexistent', ['m']);
      expect(result).toEqual([]);
      expect(mockTierRepo.save).not.toHaveBeenCalled();
    });

    it('should set null when empty array provided', async () => {
      const existing = { agent_id: 'a1', tier: 'standard', fallback_models: ['old'] };
      mockTierRepo.findOne.mockResolvedValue(existing);
      await service.setFallbacks('a1', 'standard', []);
      expect(existing.fallback_models).toBeNull();
    });
  });

  /* ── clearFallbacks ── */

  describe('clearFallbacks', () => {
    it('should clear fallback_models on existing tier', async () => {
      const existing = { agent_id: 'a1', tier: 'standard', fallback_models: ['model-a'] };
      mockTierRepo.findOne.mockResolvedValue(existing);
      await service.clearFallbacks('a1', 'standard');
      expect(existing.fallback_models).toBeNull();
      expect(mockTierRepo.save).toHaveBeenCalled();
    });

    it('should be a no-op when tier does not exist', async () => {
      mockTierRepo.findOne.mockResolvedValue(null);
      await service.clearFallbacks('a1', 'nonexistent');
      expect(mockTierRepo.save).not.toHaveBeenCalled();
    });
  });

  /* ── getProviderApiKey ── */

  describe('getProviderApiKey', () => {
    it('should return decrypted key when provider is active and has encrypted key', async () => {
      const { encrypt, getEncryptionSecret } = await import('../common/utils/crypto.util');
      const secret = getEncryptionSecret();
      const encrypted = encrypt('sk-test-key', secret);

      mockProviderRepo.find.mockResolvedValue([
        {
          agent_id: 'a1',
          provider: 'openai',
          is_active: true,
          api_key_encrypted: encrypted,
        },
      ]);

      const result = await service.getProviderApiKey('a1', 'openai');
      expect(result).toBe('sk-test-key');
    });

    it('should return null when no active provider matches', async () => {
      mockProviderRepo.find.mockResolvedValue([
        {
          agent_id: 'a1',
          provider: 'anthropic',
          is_active: true,
          api_key_encrypted: 'enc',
        },
      ]);

      const result = await service.getProviderApiKey('a1', 'openai');
      expect(result).toBeNull();
    });

    it('should return null when match has no encrypted key', async () => {
      mockProviderRepo.find.mockResolvedValue([
        {
          agent_id: 'a1',
          provider: 'openai',
          is_active: true,
          api_key_encrypted: null,
        },
      ]);

      const result = await service.getProviderApiKey('a1', 'openai');
      expect(result).toBeNull();
    });

    it('should return null when decryption fails', async () => {
      mockProviderRepo.find.mockResolvedValue([
        {
          agent_id: 'a1',
          provider: 'openai',
          is_active: true,
          api_key_encrypted: 'invalid:encrypted:data:format',
        },
      ]);

      const result = await service.getProviderApiKey('a1', 'openai');
      expect(result).toBeNull();
    });

    it('should resolve aliases (e.g. google matches gemini provider)', async () => {
      const { encrypt, getEncryptionSecret } = await import('../common/utils/crypto.util');
      const secret = getEncryptionSecret();
      const encrypted = encrypt('AIza-test', secret);

      mockProviderRepo.find.mockResolvedValue([
        {
          agent_id: 'a1',
          provider: 'gemini',
          is_active: true,
          api_key_encrypted: encrypted,
        },
      ]);

      const result = await service.getProviderApiKey('a1', 'google');
      expect(result).toBe('AIza-test');
    });

    it('should return null when no records exist', async () => {
      mockProviderRepo.find.mockResolvedValue([]);

      const result = await service.getProviderApiKey('a1', 'openai');
      expect(result).toBeNull();
    });

    it('should return cached key on second call without DB lookup', async () => {
      const { encrypt, getEncryptionSecret } = await import('../common/utils/crypto.util');
      const secret = getEncryptionSecret();
      const encrypted = encrypt('sk-cached-key', secret);

      mockProviderRepo.find.mockResolvedValue([
        { agent_id: 'a1', provider: 'openai', is_active: true, api_key_encrypted: encrypted },
      ]);

      const first = await service.getProviderApiKey('a1', 'openai');
      expect(first).toBe('sk-cached-key');
      expect(mockProviderRepo.find).toHaveBeenCalledTimes(1);

      const second = await service.getProviderApiKey('a1', 'openai');
      expect(second).toBe('sk-cached-key');
      expect(mockProviderRepo.find).toHaveBeenCalledTimes(1);
    });

    it('should return empty string for Ollama provider without DB lookup', async () => {
      const result = await service.getProviderApiKey('a1', 'Ollama');
      expect(result).toBe('');
      expect(mockProviderRepo.find).not.toHaveBeenCalled();
    });

    it('should return decrypted token for subscription provider with stored key', async () => {
      const { encrypt, getEncryptionSecret } = await import('../common/utils/crypto.util');
      const secret = getEncryptionSecret();
      const encrypted = encrypt('skst-token-123', secret);

      mockProviderRepo.find.mockResolvedValue([
        {
          agent_id: 'a1',
          provider: 'anthropic',
          is_active: true,
          auth_type: 'subscription',
          api_key_encrypted: encrypted,
        },
      ]);

      const result = await service.getProviderApiKey('a1', 'anthropic');
      expect(result).toBe('skst-token-123');
    });

    it('should return null for subscription provider without stored key', async () => {
      mockProviderRepo.find.mockResolvedValue([
        {
          agent_id: 'a1',
          provider: 'anthropic',
          is_active: true,
          auth_type: 'subscription',
          api_key_encrypted: null,
        },
      ]);

      const result = await service.getProviderApiKey('a1', 'anthropic');
      expect(result).toBeNull();
    });

    it('should return null for subscription provider when decrypt fails', async () => {
      mockProviderRepo.find.mockResolvedValue([
        {
          agent_id: 'a1',
          provider: 'anthropic',
          is_active: true,
          auth_type: 'subscription',
          api_key_encrypted: 'invalid:encrypted:data:format',
        },
      ]);

      const result = await service.getProviderApiKey('a1', 'anthropic');
      expect(result).toBeNull();
    });

    it('should return empty string for ollama in any case', async () => {
      const result = await service.getProviderApiKey('a1', 'OLLAMA');
      expect(result).toBe('');
      expect(mockProviderRepo.find).not.toHaveBeenCalled();
    });

    it('should return decrypted key for custom: provider with encrypted key', async () => {
      const { encrypt, getEncryptionSecret } = await import('../common/utils/crypto.util');
      const secret = getEncryptionSecret();
      const encrypted = encrypt('custom-api-key-123', secret);

      mockProviderRepo.findOne.mockResolvedValue({
        agent_id: 'a1',
        provider: 'custom:cp-uuid',
        is_active: true,
        api_key_encrypted: encrypted,
      });

      const result = await service.getProviderApiKey('a1', 'custom:cp-uuid');
      expect(result).toBe('custom-api-key-123');
      expect(mockProviderRepo.findOne).toHaveBeenCalledWith({
        where: { agent_id: 'a1', provider: 'custom:cp-uuid', is_active: true },
      });
    });

    it('should return empty string for custom: provider without encrypted key', async () => {
      mockProviderRepo.findOne.mockResolvedValue({
        agent_id: 'a1',
        provider: 'custom:cp-uuid',
        is_active: true,
        api_key_encrypted: null,
      });

      const result = await service.getProviderApiKey('a1', 'custom:cp-uuid');
      expect(result).toBe('');
    });

    it('should return null for custom: provider not found', async () => {
      mockProviderRepo.findOne.mockResolvedValue(null);

      const result = await service.getProviderApiKey('a1', 'custom:cp-missing');
      expect(result).toBeNull();
    });

    it('should prefer api_key over subscription when both exist', async () => {
      const { encrypt, getEncryptionSecret } = await import('../common/utils/crypto.util');
      const secret = getEncryptionSecret();
      const apiKeyEncrypted = encrypt('sk-api-key-123', secret);
      const subTokenEncrypted = encrypt('skst-sub-token', secret);

      mockProviderRepo.find.mockResolvedValue([
        {
          agent_id: 'a1',
          provider: 'anthropic',
          is_active: true,
          auth_type: 'subscription',
          api_key_encrypted: subTokenEncrypted,
        },
        {
          agent_id: 'a1',
          provider: 'anthropic',
          is_active: true,
          auth_type: 'api_key',
          api_key_encrypted: apiKeyEncrypted,
        },
      ]);

      const result = await service.getProviderApiKey('a1', 'anthropic');
      expect(result).toBe('sk-api-key-123');
    });

    it('should fall back to subscription when api_key has no encrypted key', async () => {
      const { encrypt, getEncryptionSecret } = await import('../common/utils/crypto.util');
      const secret = getEncryptionSecret();
      const subTokenEncrypted = encrypt('skst-sub-token', secret);

      mockProviderRepo.find.mockResolvedValue([
        {
          agent_id: 'a1',
          provider: 'anthropic',
          is_active: true,
          auth_type: 'api_key',
          api_key_encrypted: null,
        },
        {
          agent_id: 'a1',
          provider: 'anthropic',
          is_active: true,
          auth_type: 'subscription',
          api_key_encrypted: subTokenEncrypted,
        },
      ]);

      const result = await service.getProviderApiKey('a1', 'anthropic');
      expect(result).toBe('skst-sub-token');
    });

    it('should prefer subscription when preferredAuthType is subscription', async () => {
      const { encrypt, getEncryptionSecret } = await import('../common/utils/crypto.util');
      const secret = getEncryptionSecret();
      const apiKeyEncrypted = encrypt('sk-api-key', secret);
      const subTokenEncrypted = encrypt('skst-sub-token', secret);

      mockProviderRepo.find.mockResolvedValue([
        {
          agent_id: 'a1',
          provider: 'anthropic',
          is_active: true,
          auth_type: 'api_key',
          api_key_encrypted: apiKeyEncrypted,
        },
        {
          agent_id: 'a1',
          provider: 'anthropic',
          is_active: true,
          auth_type: 'subscription',
          api_key_encrypted: subTokenEncrypted,
        },
      ]);

      const result = await service.getProviderApiKey('a1', 'anthropic', 'subscription');
      expect(result).toBe('skst-sub-token');
    });

    it('should prefer api_key when preferredAuthType is api_key with both present', async () => {
      const { encrypt, getEncryptionSecret } = await import('../common/utils/crypto.util');
      const secret = getEncryptionSecret();
      const apiKeyEncrypted = encrypt('sk-api-key', secret);
      const subTokenEncrypted = encrypt('skst-sub-token', secret);

      mockProviderRepo.find.mockResolvedValue([
        {
          agent_id: 'a1',
          provider: 'anthropic',
          is_active: true,
          auth_type: 'subscription',
          api_key_encrypted: subTokenEncrypted,
        },
        {
          agent_id: 'a1',
          provider: 'anthropic',
          is_active: true,
          auth_type: 'api_key',
          api_key_encrypted: apiKeyEncrypted,
        },
      ]);

      const result = await service.getProviderApiKey('a1', 'anthropic', 'api_key');
      expect(result).toBe('sk-api-key');
    });

    it('should fall back to subscription when preferred api_key has no encrypted key', async () => {
      const { encrypt, getEncryptionSecret } = await import('../common/utils/crypto.util');
      const secret = getEncryptionSecret();
      const subTokenEncrypted = encrypt('skst-fallback', secret);

      mockProviderRepo.find.mockResolvedValue([
        {
          agent_id: 'a1',
          provider: 'anthropic',
          is_active: true,
          auth_type: 'api_key',
          api_key_encrypted: null,
        },
        {
          agent_id: 'a1',
          provider: 'anthropic',
          is_active: true,
          auth_type: 'subscription',
          api_key_encrypted: subTokenEncrypted,
        },
      ]);

      const result = await service.getProviderApiKey('a1', 'anthropic', 'api_key');
      expect(result).toBe('skst-fallback');
    });

    it('should return null for custom: provider when decrypt fails', async () => {
      mockProviderRepo.findOne.mockResolvedValue({
        agent_id: 'a1',
        provider: 'custom:cp-uuid',
        is_active: true,
        api_key_encrypted: 'invalid:encrypted:data:format',
      });

      const result = await service.getProviderApiKey('a1', 'custom:cp-uuid');
      expect(result).toBeNull();
    });
  });

  describe('getAuthType', () => {
    it('should return subscription when active subscription provider with encrypted key exists', async () => {
      mockProviderRepo.find.mockResolvedValue([
        {
          agent_id: 'a1',
          provider: 'anthropic',
          is_active: true,
          auth_type: 'subscription',
          api_key_encrypted: 'enc-token',
        },
      ]);

      const result = await service.getAuthType('a1', 'anthropic');
      expect(result).toBe('subscription');
    });

    it('should return api_key when only api_key provider exists', async () => {
      mockProviderRepo.find.mockResolvedValue([
        {
          agent_id: 'a1',
          provider: 'anthropic',
          is_active: true,
          auth_type: 'api_key',
          api_key_encrypted: 'enc-key',
        },
      ]);

      const result = await service.getAuthType('a1', 'anthropic');
      expect(result).toBe('api_key');
    });

    it('should return api_key as default when no providers match', async () => {
      mockProviderRepo.find.mockResolvedValue([]);

      const result = await service.getAuthType('a1', 'anthropic');
      expect(result).toBe('api_key');
    });

    it('should prefer subscription over api_key when both exist with encrypted key', async () => {
      mockProviderRepo.find.mockResolvedValue([
        {
          agent_id: 'a1',
          provider: 'anthropic',
          is_active: true,
          auth_type: 'api_key',
          api_key_encrypted: 'enc-api-key',
        },
        {
          agent_id: 'a1',
          provider: 'anthropic',
          is_active: true,
          auth_type: 'subscription',
          api_key_encrypted: 'enc-sub-token',
        },
      ]);

      const result = await service.getAuthType('a1', 'anthropic');
      expect(result).toBe('subscription');
    });

    it('should fall back to auth_type when subscription has no encrypted key', async () => {
      mockProviderRepo.find.mockResolvedValue([
        {
          agent_id: 'a1',
          provider: 'anthropic',
          is_active: true,
          auth_type: 'subscription',
          api_key_encrypted: null,
        },
      ]);

      const result = await service.getAuthType('a1', 'anthropic');
      // subMatch check fails because api_key_encrypted is null,
      // falls through to matches[0]?.auth_type
      expect(result).toBe('subscription');
    });

    it('should skip inactive providers', async () => {
      mockProviderRepo.find.mockResolvedValue([
        {
          agent_id: 'a1',
          provider: 'anthropic',
          is_active: false,
          auth_type: 'subscription',
          api_key_encrypted: 'enc-token',
        },
      ]);

      const result = await service.getAuthType('a1', 'anthropic');
      expect(result).toBe('api_key');
    });
  });
});
