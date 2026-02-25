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
    process.env['BETTER_AUTH_SECRET'] = 'a'.repeat(32);
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
    it('should create a new provider when none exists (with apiKey)', async () => {
      mockProviderRepo.findOne.mockResolvedValue(null);

      const result = await service.upsertProvider('u1', 'openai', 'enc-key');

      expect(mockProviderRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'u1',
          provider: 'openai',
          is_active: true,
        }),
      );
      const inserted = mockProviderRepo.insert.mock.calls[0][0];
      expect(inserted.api_key_encrypted).not.toBe('enc-key');
      expect(inserted.api_key_encrypted).toContain(':');
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('u1');
      expect(result.provider.provider).toBe('openai');
      expect(result.provider.is_active).toBe(true);
      expect(result.isNew).toBe(true);
    });

    it('should create a new provider without apiKey (null encrypted)', async () => {
      mockProviderRepo.findOne.mockResolvedValue(null);

      const result = await service.upsertProvider('u1', 'openai');

      const inserted = mockProviderRepo.insert.mock.calls[0][0];
      expect(inserted.api_key_encrypted).toBeNull();
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('u1');
      expect(result.provider.provider).toBe('openai');
      expect(result.provider.is_active).toBe(true);
      expect(result.isNew).toBe(true);
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
          is_active: true,
        }),
      );
      const saved = mockProviderRepo.save.mock.calls[0][0];
      expect(saved.api_key_encrypted).not.toBe('new-key');
      expect(saved.api_key_encrypted).toContain(':');
      expect(mockProviderRepo.insert).not.toHaveBeenCalled();
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('u1');
      expect(result.provider.api_key_encrypted).toContain(':');
      expect(result.provider.is_active).toBe(true);
      expect(result.isNew).toBe(false);
    });

    it('should reactivate existing provider without changing key when no apiKey', async () => {
      const existing = Object.assign(new UserProvider(), {
        id: 'p1',
        user_id: 'u1',
        provider: 'openai',
        api_key_encrypted: 'old-encrypted',
        is_active: false,
      });
      mockProviderRepo.findOne.mockResolvedValue(existing);

      const result = await service.upsertProvider('u1', 'openai');

      expect(result.provider.is_active).toBe(true);
      expect(result.provider.api_key_encrypted).toBe('old-encrypted');
      expect(result.isNew).toBe(false);
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('u1');
    });

    it('should return object with exactly provider and isNew keys', async () => {
      mockProviderRepo.findOne.mockResolvedValue(null);

      const result = await service.upsertProvider('u1', 'openai', 'key');

      expect(Object.keys(result).sort()).toEqual(['isNew', 'provider']);
      expect(result.provider).toBeDefined();
      expect(typeof result.isNew).toBe('boolean');
    });

    it('should set connected_at and updated_at on new provider', async () => {
      mockProviderRepo.findOne.mockResolvedValue(null);

      const before = new Date().toISOString();
      const result = await service.upsertProvider('u1', 'openai', 'key');
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
        provider: 'openai',
        api_key_encrypted: 'old-encrypted',
        is_active: false,
        connected_at: originalConnectedAt,
        updated_at: '2025-01-01T00:00:00.000Z',
      });
      mockProviderRepo.findOne.mockResolvedValue(existing);

      const before = new Date().toISOString();
      await service.upsertProvider('u1', 'openai', 'new-key');

      const saved = mockProviderRepo.save.mock.calls[0][0];
      expect(saved.connected_at).toBe(originalConnectedAt);
      expect(saved.updated_at >= before).toBe(true);
    });

    it('should generate a UUID id for new provider', async () => {
      mockProviderRepo.findOne.mockResolvedValue(null);

      await service.upsertProvider('u1', 'openai', 'key');

      const inserted = mockProviderRepo.insert.mock.calls[0][0];
      expect(inserted.id).toBeDefined();
      expect(typeof inserted.id).toBe('string');
      // UUID v4 format: 8-4-4-4-12
      expect(inserted.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
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

  /* ── deactivateAllProviders ── */

  describe('deactivateAllProviders', () => {
    it('should deactivate all providers, clear overrides, and recalculate', async () => {
      await service.deactivateAllProviders('u1');

      expect(mockProviderRepo.update).toHaveBeenCalledWith(
        { user_id: 'u1' },
        expect.objectContaining({ is_active: false }),
      );
      expect(mockTierRepo.update).toHaveBeenCalledWith(
        { user_id: 'u1' },
        expect.objectContaining({ override_model: null }),
      );
      expect(mockAutoAssign.recalculate).toHaveBeenCalledWith('u1');
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

  /* ── getKeyPrefix ── */

  describe('getKeyPrefix', () => {
    it('should return null when encryptedKey is null', () => {
      const result = service.getKeyPrefix(null);
      expect(result).toBeNull();
    });

    it('should return null when encryptedKey is empty string', () => {
      const result = service.getKeyPrefix('');
      expect(result).toBeNull();
    });

    it('should return first 8 chars of decrypted key', async () => {
      const { encrypt, getEncryptionSecret } = await import(
        '../common/utils/crypto.util'
      );
      const secret = getEncryptionSecret();
      const encrypted = encrypt('sk-abcdefghijklmnop', secret);

      const result = service.getKeyPrefix(encrypted);
      expect(result).toBe('sk-abcde');
    });

    it('should return custom length prefix', async () => {
      const { encrypt, getEncryptionSecret } = await import(
        '../common/utils/crypto.util'
      );
      const secret = getEncryptionSecret();
      const encrypted = encrypt('sk-abcdefghijklmnop', secret);

      const result = service.getKeyPrefix(encrypted, 4);
      expect(result).toBe('sk-a');
    });

    it('should return null and log warning when decrypt throws', () => {
      const warnSpy = jest.spyOn(
        (service as any).logger,
        'warn',
      );

      const result = service.getKeyPrefix('invalid:encrypted:data');
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to decrypt API key for prefix extraction',
      );
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
          user_id: 'u1',
          provider: 'openai',
          is_active: true,
          api_key_encrypted: encrypted,
        },
      ]);

      const result = await service.getProviderApiKey('u1', 'openai');
      expect(result).toBe('sk-test-key');
    });

    it('should return null when no active provider matches', async () => {
      mockProviderRepo.find.mockResolvedValue([
        {
          user_id: 'u1',
          provider: 'anthropic',
          is_active: true,
          api_key_encrypted: 'enc',
        },
      ]);

      const result = await service.getProviderApiKey('u1', 'openai');
      expect(result).toBeNull();
    });

    it('should return null when match has no encrypted key', async () => {
      mockProviderRepo.find.mockResolvedValue([
        {
          user_id: 'u1',
          provider: 'openai',
          is_active: true,
          api_key_encrypted: null,
        },
      ]);

      const result = await service.getProviderApiKey('u1', 'openai');
      expect(result).toBeNull();
    });

    it('should return null when decryption fails', async () => {
      mockProviderRepo.find.mockResolvedValue([
        {
          user_id: 'u1',
          provider: 'openai',
          is_active: true,
          api_key_encrypted: 'invalid:encrypted:data:format',
        },
      ]);

      const result = await service.getProviderApiKey('u1', 'openai');
      expect(result).toBeNull();
    });

    it('should resolve aliases (e.g. google matches gemini provider)', async () => {
      const { encrypt, getEncryptionSecret } = await import('../common/utils/crypto.util');
      const secret = getEncryptionSecret();
      const encrypted = encrypt('AIza-test', secret);

      mockProviderRepo.find.mockResolvedValue([
        {
          user_id: 'u1',
          provider: 'gemini',
          is_active: true,
          api_key_encrypted: encrypted,
        },
      ]);

      const result = await service.getProviderApiKey('u1', 'google');
      expect(result).toBe('AIza-test');
    });

    it('should return null when no records exist', async () => {
      mockProviderRepo.find.mockResolvedValue([]);

      const result = await service.getProviderApiKey('u1', 'openai');
      expect(result).toBeNull();
    });
  });
});
