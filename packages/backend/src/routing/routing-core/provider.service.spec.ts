import { NotFoundException } from '@nestjs/common';
import { ProviderService } from './provider.service';
import { TierAutoAssignService } from './tier-auto-assign.service';
import { RoutingCacheService } from './routing-cache.service';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { UserProvider } from '../../entities/user-provider.entity';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import { SpecificityAssignment } from '../../entities/specificity-assignment.entity';

jest.mock('../../common/utils/crypto.util', () => ({
  encrypt: jest.fn().mockReturnValue('encrypted-value'),
  getEncryptionSecret: jest.fn().mockReturnValue('secret'),
}));

jest.mock('../../common/utils/subscription-support', () => ({
  isSupportedSubscriptionProvider: jest.fn().mockReturnValue(false),
  isManifestUsableProvider: jest.fn((record: { auth_type?: string; provider?: string }) => {
    if (record.auth_type !== 'subscription') return true;
    return record.provider === 'anthropic';
  }),
}));

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  remove: jest.Mock;
  manager: { transaction: jest.Mock };
};

function makeMockRepo(): MockRepo {
  const find = jest.fn().mockResolvedValue([]);
  const findOne = jest.fn().mockResolvedValue(null);
  const save = jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity));
  const insert = jest.fn().mockResolvedValue(undefined);
  const update = jest.fn().mockResolvedValue(undefined);
  const remove = jest.fn().mockResolvedValue(undefined);
  const repoFacade = { find, findOne, save, insert, update, remove };
  // The real Repository.manager.transaction(cb) invokes cb with an
  // EntityManager; our mock invokes cb with a thin shim that routes
  // getRepository() back to this same facade. Mirrors proxy-message-dedup's
  // test setup so assertions stay at the repo level.
  const manager = {
    transaction: jest.fn(async (cb: (m: { getRepository: () => unknown }) => Promise<unknown>) =>
      cb({ getRepository: () => repoFacade }),
    ),
  };
  return { find, findOne, save, insert, update, remove, manager };
}

function makeProvider(overrides: Partial<UserProvider> = {}): UserProvider {
  return Object.assign(new UserProvider(), {
    id: 'prov-1',
    user_id: 'user-1',
    agent_id: 'agent-1',
    provider: 'openai',
    auth_type: 'api_key' as const,
    api_key_encrypted: 'enc-key',
    key_prefix: 'sk-proj-',
    is_active: true,
    connected_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    cached_models: null,
    models_fetched_at: null,
    ...overrides,
  });
}

function makeTier(overrides: Partial<TierAssignment> = {}): TierAssignment {
  return Object.assign(new TierAssignment(), {
    id: 'tier-1',
    user_id: 'user-1',
    agent_id: 'agent-1',
    tier: 'simple',
    override_model: null,
    override_provider: null,
    override_auth_type: null,
    auto_assigned_model: 'gpt-4o-mini',
    fallback_models: null,
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  });
}

describe('ProviderService', () => {
  let service: ProviderService;
  let providerRepo: ReturnType<typeof makeMockRepo>;
  let tierRepo: ReturnType<typeof makeMockRepo>;
  let specificityRepo: ReturnType<typeof makeMockRepo>;
  let autoAssign: { recalculate: jest.Mock };
  let routingCache: {
    invalidateAgent: jest.Mock;
    getProviders: jest.Mock;
    setProviders: jest.Mock;
  };
  let pricingCache: { getByModel: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    providerRepo = makeMockRepo();
    tierRepo = makeMockRepo();
    specificityRepo = makeMockRepo();
    autoAssign = { recalculate: jest.fn().mockResolvedValue(undefined) };
    routingCache = {
      invalidateAgent: jest.fn(),
      getProviders: jest.fn().mockReturnValue(null),
      setProviders: jest.fn(),
    };
    pricingCache = { getByModel: jest.fn().mockReturnValue(undefined) };

    service = new ProviderService(
      providerRepo as unknown as any,
      tierRepo as unknown as any,
      specificityRepo as unknown as any,
      autoAssign as unknown as TierAutoAssignService,
      pricingCache as unknown as ModelPricingCacheService,
      routingCache as unknown as RoutingCacheService,
    );
  });

  /* ── recalculateTiers ── */

  describe('recalculateTiers', () => {
    it('should call autoAssign.recalculate and invalidate cache', async () => {
      await service.recalculateTiers('agent-1');

      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-1');
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });
  });

  /* ── getProviders ── */

  describe('getProviders', () => {
    it('should return cached providers when available', async () => {
      const cached = [makeProvider()];
      routingCache.getProviders.mockReturnValue(cached);

      const result = await service.getProviders('agent-1');

      expect(result).toBe(cached);
      expect(providerRepo.find).not.toHaveBeenCalled();
    });

    it('should fetch from DB and cache when no cache', async () => {
      const provider = makeProvider();
      providerRepo.find.mockResolvedValue([provider]);

      const result = await service.getProviders('agent-1');

      expect(result).toEqual([provider]);
      expect(routingCache.setProviders).toHaveBeenCalledWith('agent-1', [provider]);
    });

    it('should filter out unsupported subscription providers via isManifestUsableProvider', async () => {
      const apiKeyProvider = makeProvider({ id: 'p1', auth_type: 'api_key', provider: 'openai' });
      const unsupSub = makeProvider({
        id: 'p2',
        auth_type: 'subscription',
        provider: 'unsupported-provider',
      });
      providerRepo.find.mockResolvedValueOnce([]).mockResolvedValueOnce([apiKeyProvider, unsupSub]);

      const result = await service.getProviders('agent-1');

      expect(result).toEqual([apiKeyProvider]);
    });
  });

  /* ── upsertProvider ── */

  describe('upsertProvider', () => {
    it('should update existing provider with new apiKey', async () => {
      const existing = makeProvider();
      providerRepo.findOne.mockResolvedValue(existing);

      const result = await service.upsertProvider('agent-1', 'user-1', 'openai', 'sk-new-key');

      expect(existing.api_key_encrypted).toBe('encrypted-value');
      expect(existing.is_active).toBe(true);
      expect(result).toEqual({ provider: existing, isNew: false });
      expect(providerRepo.save).toHaveBeenCalledWith(existing);
      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-1');
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('should not overwrite encrypted key when apiKey is not provided', async () => {
      const existing = makeProvider({ api_key_encrypted: 'original-enc' });
      providerRepo.findOne.mockResolvedValue(existing);

      await service.upsertProvider('agent-1', 'user-1', 'openai');

      expect(existing.api_key_encrypted).toBe('original-enc');
    });

    it('should create new provider when not existing', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      const result = await service.upsertProvider('agent-1', 'user-1', 'anthropic', 'sk-ant-key');

      expect(result.isNew).toBe(true);
      expect(result.provider.provider).toBe('anthropic');
      expect(providerRepo.insert).toHaveBeenCalled();
      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-1');
    });

    it('should default authType to api_key when not provided', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      const result = await service.upsertProvider('agent-1', 'user-1', 'openai', 'sk-key');

      expect(providerRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { agent_id: 'agent-1', provider: 'openai', auth_type: 'api_key' },
        }),
      );
      expect(result.provider.auth_type).toBe('api_key');
    });

    it('should use provided authType for lookup and creation', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await service.upsertProvider('agent-1', 'user-1', 'anthropic', undefined, 'subscription');

      expect(providerRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { agent_id: 'agent-1', provider: 'anthropic', auth_type: 'subscription' },
        }),
      );
    });

    it('should set key_prefix from apiKey substring', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      const result = await service.upsertProvider('agent-1', 'user-1', 'openai', 'sk-proj-12345');

      expect(result.provider.key_prefix).toBe('sk-proj-');
    });

    it('should set null key_prefix when apiKey is not provided', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      const result = await service.upsertProvider('agent-1', 'user-1', 'openai');

      expect(result.provider.key_prefix).toBeNull();
      expect(result.provider.api_key_encrypted).toBeNull();
    });
  });

  /* ── registerSubscriptionProvider ── */

  describe('registerSubscriptionProvider', () => {
    it('should return isNew false when provider is not supported', async () => {
      const result = await service.registerSubscriptionProvider('agent-1', 'user-1', 'openai');

      expect(result).toEqual({ isNew: false });
      expect(providerRepo.findOne).not.toHaveBeenCalled();
    });

    it('should return isNew false when subscription record already exists', async () => {
      const { isSupportedSubscriptionProvider } = jest.requireMock(
        '../../common/utils/subscription-support',
      );
      isSupportedSubscriptionProvider.mockReturnValueOnce(true);
      providerRepo.findOne.mockResolvedValueOnce(makeProvider({ auth_type: 'subscription' }));

      const result = await service.registerSubscriptionProvider('agent-1', 'user-1', 'anthropic');

      expect(result).toEqual({ isNew: false });
    });

    it('should return isNew false when active api_key record exists', async () => {
      const { isSupportedSubscriptionProvider } = jest.requireMock(
        '../../common/utils/subscription-support',
      );
      isSupportedSubscriptionProvider.mockReturnValueOnce(true);
      providerRepo.findOne
        .mockResolvedValueOnce(null) // no subscription
        .mockResolvedValueOnce(makeProvider({ auth_type: 'api_key', is_active: true }));

      const result = await service.registerSubscriptionProvider('agent-1', 'user-1', 'anthropic');

      expect(result).toEqual({ isNew: false });
    });

    it('should create subscription record when no existing records', async () => {
      const { isSupportedSubscriptionProvider } = jest.requireMock(
        '../../common/utils/subscription-support',
      );
      isSupportedSubscriptionProvider.mockReturnValueOnce(true);
      providerRepo.findOne
        .mockResolvedValueOnce(null) // no subscription
        .mockResolvedValueOnce(null); // no api_key

      const result = await service.registerSubscriptionProvider('agent-1', 'user-1', 'anthropic');

      expect(result).toEqual({ isNew: true });
      expect(providerRepo.insert).toHaveBeenCalled();
      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-1');
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });
  });

  /* ── retagAuthType ── */

  describe('retagAuthType', () => {
    it('flips auth_type in place on the existing row without touching tier overrides', async () => {
      const existing = makeProvider({
        id: 'p-1',
        provider: 'custom:abc',
        auth_type: 'api_key',
        api_key_encrypted: 'enc',
      });
      providerRepo.find.mockResolvedValue([existing]);

      await service.retagAuthType('agent-1', 'custom:abc', 'local');

      expect(existing.auth_type).toBe('local');
      expect(providerRepo.save).toHaveBeenCalledWith(existing);
      expect(autoAssign.recalculate).not.toHaveBeenCalled();
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('removes a colliding destination row before flipping, protecting the unique index', async () => {
      const target = makeProvider({
        id: 'p-target',
        provider: 'custom:abc',
        auth_type: 'api_key',
      });
      const collision = makeProvider({
        id: 'p-collision',
        provider: 'custom:abc',
        auth_type: 'local',
      });
      providerRepo.find.mockResolvedValue([target, collision]);

      await service.retagAuthType('agent-1', 'custom:abc', 'local');

      expect(providerRepo.remove).toHaveBeenCalledWith(collision);
      expect(target.auth_type).toBe('local');
    });

    it('is a no-op when no active row matches the source auth_type', async () => {
      providerRepo.find.mockResolvedValue([]);

      await service.retagAuthType('agent-1', 'custom:abc', 'local');

      expect(providerRepo.save).not.toHaveBeenCalled();
      expect(routingCache.invalidateAgent).not.toHaveBeenCalled();
    });
  });

  /* ── removeProvider ── */

  describe('removeProvider', () => {
    it('should throw NotFoundException when provider not found', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await expect(service.removeProvider('agent-1', 'openai')).rejects.toThrow(NotFoundException);
    });

    it('should deactivate provider and skip override clearing when other active provider exists', async () => {
      const existing = makeProvider({ is_active: true });
      providerRepo.findOne.mockResolvedValue(existing);
      // Other active provider of same type that is usable (api_key)
      providerRepo.find.mockResolvedValue([makeProvider({ id: 'p2', auth_type: 'api_key' })]);

      const result = await service.removeProvider('agent-1', 'openai');

      expect(existing.is_active).toBe(false);
      expect(result).toEqual({ notifications: [] });
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });

    it('should clear tier assignments when no other active provider', async () => {
      const existing = makeProvider({ is_active: true });
      providerRepo.findOne.mockResolvedValue(existing);
      providerRepo.find.mockResolvedValue([]);
      tierRepo.find
        .mockResolvedValueOnce([]) // overrides query
        .mockResolvedValueOnce([]); // allTiers query

      const result = await service.removeProvider('agent-1', 'openai');

      expect(result).toEqual({ notifications: [] });
      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-1');
    });

    it('should generate notifications for invalidated tier overrides', async () => {
      const existing = makeProvider({ is_active: true });
      providerRepo.findOne.mockResolvedValue(existing);
      providerRepo.find.mockResolvedValue([]);

      const overrideTier = makeTier({
        override_model: 'gpt-4o',
        override_provider: 'openai',
        tier: 'complex',
      });
      tierRepo.find
        .mockResolvedValueOnce([overrideTier]) // overrides (Not IsNull)
        .mockResolvedValueOnce([overrideTier]); // allTiers

      // After recalculate, the tier's auto-assigned model is updated
      const updatedTier = makeTier({
        tier: 'complex',
        auto_assigned_model: 'claude-3-haiku',
        override_model: null,
      });
      tierRepo.find.mockResolvedValueOnce([updatedTier]); // In(tierNames) lookup

      pricingCache.getByModel.mockReturnValue({ provider: 'openai' });

      const result = await service.removeProvider('agent-1', 'openai');

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]).toContain('gpt-4o is no longer available');
      expect(result.notifications[0]).toContain('Complex is back to automatic mode');
      expect(result.notifications[0]).toContain('claude-3-haiku');
    });

    it('should generate notification without model when auto_assigned_model is null', async () => {
      const existing = makeProvider({ is_active: true });
      providerRepo.findOne.mockResolvedValue(existing);
      providerRepo.find.mockResolvedValue([]);

      const overrideTier = makeTier({
        override_model: 'gpt-4o',
        override_provider: 'openai',
        tier: 'simple',
      });
      tierRepo.find.mockResolvedValueOnce([overrideTier]).mockResolvedValueOnce([overrideTier]);

      const updatedTier = makeTier({
        tier: 'simple',
        auto_assigned_model: null,
        override_model: null,
      });
      tierRepo.find.mockResolvedValueOnce([updatedTier]);

      pricingCache.getByModel.mockReturnValue({ provider: 'openai' });

      const result = await service.removeProvider('agent-1', 'openai');

      expect(result.notifications[0]).toContain('Simple is back to automatic mode.');
      expect(result.notifications[0]).not.toContain('(');
    });

    it('should pass authType filter when provided', async () => {
      const existing = makeProvider({ is_active: true });
      providerRepo.findOne.mockResolvedValue(existing);
      providerRepo.find.mockResolvedValue([]);
      tierRepo.find.mockResolvedValue([]);

      await service.removeProvider('agent-1', 'openai', 'api_key');

      expect(providerRepo.findOne).toHaveBeenCalledWith({
        where: { agent_id: 'agent-1', provider: 'openai', auth_type: 'api_key' },
      });
    });

    it('should use tier label for unknown tier names', async () => {
      const existing = makeProvider({ is_active: true });
      providerRepo.findOne.mockResolvedValue(existing);
      providerRepo.find.mockResolvedValue([]);

      const overrideTier = makeTier({
        override_model: 'gpt-4o',
        override_provider: 'openai',
        tier: 'unknown-tier',
      });
      tierRepo.find.mockResolvedValueOnce([overrideTier]).mockResolvedValueOnce([overrideTier]);

      const updatedTier = makeTier({
        tier: 'unknown-tier',
        auto_assigned_model: null,
        override_model: null,
      });
      tierRepo.find.mockResolvedValueOnce([updatedTier]);

      pricingCache.getByModel.mockReturnValue({ provider: 'openai' });

      const result = await service.removeProvider('agent-1', 'openai');

      expect(result.notifications[0]).toContain('unknown-tier is back to automatic mode');
    });
  });

  /* ── deactivateAllProviders ── */

  describe('deactivateAllProviders', () => {
    it('should deactivate all providers and clear all tier overrides', async () => {
      await service.deactivateAllProviders('agent-1');

      expect(providerRepo.update).toHaveBeenCalledWith(
        { agent_id: 'agent-1' },
        expect.objectContaining({ is_active: false }),
      );
      expect(tierRepo.update).toHaveBeenCalledWith(
        { agent_id: 'agent-1' },
        expect.objectContaining({
          override_model: null,
          override_provider: null,
          override_auth_type: null,
          fallback_models: null,
        }),
      );
      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-1');
      expect(routingCache.invalidateAgent).toHaveBeenCalledWith('agent-1');
    });
  });

  /* ── cleanupUnsupportedSubscriptionProviders (private, tested via getProviders) ── */

  describe('cleanupUnsupportedSubscriptionProviders (via getProviders)', () => {
    it('should deactivate unsupported subscription providers and clear tier assignments', async () => {
      const unsupported = makeProvider({
        id: 'p1',
        auth_type: 'subscription',
        provider: 'unsupported-provider',
        is_active: true,
      });
      // First find (cleanup) returns the unsupported provider
      providerRepo.find.mockResolvedValueOnce([unsupported]);
      // Second find (getProviders) returns empty after cleanup filtered out
      providerRepo.find.mockResolvedValueOnce([]);
      tierRepo.find.mockResolvedValue([]);

      await service.getProviders('agent-1');

      expect(providerRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ is_active: false }),
      ]);
    });

    it('should not clear tier assignments if no providers removed', async () => {
      providerRepo.find.mockResolvedValue([]);

      await service.getProviders('agent-1');

      expect(tierRepo.find).not.toHaveBeenCalled();
    });

    it('should skip cleanup when all subscription providers are supported', async () => {
      const supported = makeProvider({
        id: 'p1',
        auth_type: 'subscription',
        provider: 'anthropic',
        is_active: true,
      });
      providerRepo.find.mockResolvedValueOnce([supported]).mockResolvedValueOnce([supported]);

      const result = await service.getProviders('agent-1');

      expect(result).toEqual([supported]);
      // save should NOT be called since no unsupported providers found
      expect(providerRepo.save).not.toHaveBeenCalled();
    });

    it('should not remove provider from removedProviders when usable provider with same name exists', async () => {
      // Unsupported subscription that will be deactivated
      const unsupported = makeProvider({
        id: 'p1',
        auth_type: 'subscription',
        provider: 'unsupported-provider',
        is_active: true,
      });
      // Usable api_key provider with the SAME provider name
      const usableApiKey = makeProvider({
        id: 'p2',
        auth_type: 'api_key',
        provider: 'unsupported-provider',
        is_active: true,
      });
      // First find (cleanup) returns both providers
      providerRepo.find.mockResolvedValueOnce([unsupported, usableApiKey]);
      // Second find (getProviders) returns only the api_key provider
      providerRepo.find.mockResolvedValueOnce([usableApiKey]);

      await service.getProviders('agent-1');

      // The unsupported subscription was deactivated
      expect(providerRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'p1', is_active: false }),
      ]);
      // But since a usable provider with same name remains, no tier clearing should happen
      expect(tierRepo.find).not.toHaveBeenCalled();
    });

    it('should recalculate tiers when cleanup removes providers that had tier assignments', async () => {
      const unsupported = makeProvider({
        id: 'p1',
        auth_type: 'subscription',
        provider: 'unsupported-provider',
        is_active: true,
      });
      // First find (cleanup) returns the unsupported provider
      providerRepo.find.mockResolvedValueOnce([unsupported]);

      // cleanupProviderReferences returns hadTierAssignments: true
      const existingTier = makeTier({ agent_id: 'agent-1', override_model: null });
      tierRepo.find
        .mockResolvedValueOnce([]) // overrides (Not IsNull)
        .mockResolvedValueOnce([existingTier]); // allTiers (has rows = hadTierAssignments)

      // Second find (getProviders) returns empty
      providerRepo.find.mockResolvedValueOnce([]);

      await service.getProviders('agent-1');

      // Should recalculate since hadTierAssignments was true
      expect(autoAssign.recalculate).toHaveBeenCalledWith('agent-1');
    });
  });

  /* ── cleanupProviderReferences (private, tested via removeProvider) ── */

  describe('cleanupProviderReferences (via removeProvider)', () => {
    it('should clear override when pricing provider matches', async () => {
      const existing = makeProvider({ is_active: true });
      providerRepo.findOne.mockResolvedValue(existing);
      providerRepo.find.mockResolvedValue([]);

      const override = makeTier({
        override_model: 'gpt-4o',
        override_provider: null, // no override_provider
        tier: 'standard',
      });
      tierRepo.find
        .mockResolvedValueOnce([override]) // overrides
        .mockResolvedValueOnce([override]); // allTiers

      // No updated tier match needed since we won't get invalidated from tierNames
      tierRepo.find.mockResolvedValueOnce([]);

      pricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });

      const result = await service.removeProvider('agent-1', 'openai');

      expect(tierRepo.save).toHaveBeenCalled();
      expect(result.notifications).toHaveLength(1);
    });

    it('should filter fallback models belonging to removed provider', async () => {
      const existing = makeProvider({ is_active: true });
      providerRepo.findOne.mockResolvedValue(existing);
      providerRepo.find.mockResolvedValue([]);

      const tierWithFallbacks = makeTier({
        tier: 'standard',
        override_model: null,
        fallback_models: ['gpt-4o', 'claude-3-haiku'],
      });
      tierRepo.find
        .mockResolvedValueOnce([]) // overrides (no override)
        .mockResolvedValueOnce([tierWithFallbacks]); // allTiers

      pricingCache.getByModel.mockImplementation((model: string) => {
        if (model === 'gpt-4o') return { provider: 'OpenAI' };
        if (model === 'claude-3-haiku') return { provider: 'Anthropic' };
        return undefined;
      });

      await service.removeProvider('agent-1', 'openai');

      expect(tierRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ fallback_models: ['claude-3-haiku'] }),
      ]);
    });

    it('should set fallback_models to null when all fallbacks removed', async () => {
      const existing = makeProvider({ is_active: true });
      providerRepo.findOne.mockResolvedValue(existing);
      providerRepo.find.mockResolvedValue([]);

      const tierWithFallbacks = makeTier({
        tier: 'standard',
        override_model: null,
        fallback_models: ['gpt-4o'],
      });
      tierRepo.find
        .mockResolvedValueOnce([]) // overrides
        .mockResolvedValueOnce([tierWithFallbacks]); // allTiers

      pricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });

      await service.removeProvider('agent-1', 'openai');

      expect(tierRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ fallback_models: null }),
      ]);
    });

    it('should handle empty providers array (no-op)', async () => {
      const existing = makeProvider({ is_active: true });
      providerRepo.findOne.mockResolvedValue(existing);
      // other active provider with same is usable
      providerRepo.find.mockResolvedValue([makeProvider({ id: 'other', auth_type: 'api_key' })]);

      const result = await service.removeProvider('agent-1', 'openai');

      expect(result).toEqual({ notifications: [] });
    });

    it('should not duplicate tier saves when override and fallback both match', async () => {
      const existing = makeProvider({ is_active: true });
      providerRepo.findOne.mockResolvedValue(existing);
      providerRepo.find.mockResolvedValue([]);

      const tier = makeTier({
        id: 'tier-shared',
        override_model: 'gpt-4o',
        override_provider: 'openai',
        tier: 'complex',
        fallback_models: ['gpt-4o-mini'],
      });
      tierRepo.find
        .mockResolvedValueOnce([tier]) // overrides
        .mockResolvedValueOnce([tier]); // allTiers

      const updatedTier = makeTier({
        tier: 'complex',
        auto_assigned_model: null,
        override_model: null,
      });
      tierRepo.find.mockResolvedValueOnce([updatedTier]);

      pricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });

      await service.removeProvider('agent-1', 'openai');

      // Save called once, with the tier appearing only once
      const savedEntities = tierRepo.save.mock.calls[0][0] as TierAssignment[];
      const ids = savedEntities.map((t: TierAssignment) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should keep fallback models that have no pricing data', async () => {
      const existing = makeProvider({ is_active: true });
      providerRepo.findOne.mockResolvedValue(existing);
      providerRepo.find.mockResolvedValue([]);

      const tierWithFallbacks = makeTier({
        tier: 'standard',
        override_model: null,
        fallback_models: ['unknown-model', 'gpt-4o'],
      });
      tierRepo.find
        .mockResolvedValueOnce([]) // overrides
        .mockResolvedValueOnce([tierWithFallbacks]); // allTiers

      pricingCache.getByModel.mockImplementation((model: string) => {
        if (model === 'gpt-4o') return { provider: 'OpenAI' };
        return undefined; // unknown-model has no pricing
      });

      await service.removeProvider('agent-1', 'openai');

      expect(tierRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ fallback_models: ['unknown-model'] }),
      ]);
    });
  });

  /* ── cleanupProviderReferences: custom provider + specificity (#1603) ── */

  describe('cleanupProviderReferences — custom provider + specificity', () => {
    function makeSpecificity(
      overrides: Partial<SpecificityAssignment> = {},
    ): SpecificityAssignment {
      return Object.assign(new SpecificityAssignment(), {
        id: 'spec-1',
        user_id: 'user-1',
        agent_id: 'agent-1',
        category: 'coding',
        is_active: true,
        override_model: null,
        override_provider: null,
        override_auth_type: null,
        auto_assigned_model: null,
        fallback_models: null,
        updated_at: '2025-01-01T00:00:00Z',
        ...overrides,
      });
    }

    it('clears specificity overrides pointing to the deleted custom provider', async () => {
      const existing = makeProvider({ provider: 'custom:abc-123', is_active: true });
      providerRepo.findOne.mockResolvedValue(existing);
      providerRepo.find.mockResolvedValue([]);
      tierRepo.find.mockResolvedValue([]);

      const orphanSpec = makeSpecificity({
        override_model: 'custom:abc-123/gemini-2.5-flash',
        override_provider: 'custom:abc-123',
        override_auth_type: 'api_key',
      });
      specificityRepo.find.mockResolvedValue([orphanSpec]);

      await service.removeProvider('agent-1', 'custom:abc-123');

      expect(specificityRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'spec-1',
          override_model: null,
          override_provider: null,
          override_auth_type: null,
        }),
      ]);
    });

    it('clears specificity override when model uses custom prefix but override_provider is null', async () => {
      const existing = makeProvider({ provider: 'custom:abc-123', is_active: true });
      providerRepo.findOne.mockResolvedValue(existing);
      providerRepo.find.mockResolvedValue([]);
      tierRepo.find.mockResolvedValue([]);

      const orphanSpec = makeSpecificity({
        override_model: 'custom:abc-123/gemini-2.5-flash',
        override_provider: null,
      });
      specificityRepo.find.mockResolvedValue([orphanSpec]);

      await service.removeProvider('agent-1', 'custom:abc-123');

      expect(specificityRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'spec-1', override_model: null }),
      ]);
    });

    it('removes custom-prefixed entries from specificity fallback_models', async () => {
      const existing = makeProvider({ provider: 'custom:abc-123', is_active: true });
      providerRepo.findOne.mockResolvedValue(existing);
      providerRepo.find.mockResolvedValue([]);
      tierRepo.find.mockResolvedValue([]);

      const spec = makeSpecificity({
        override_model: null,
        fallback_models: ['custom:abc-123/gemini-2.5-flash', 'anthropic/claude-opus-4'],
      });
      specificityRepo.find.mockResolvedValue([spec]);

      await service.removeProvider('agent-1', 'custom:abc-123');

      expect(specificityRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ fallback_models: ['anthropic/claude-opus-4'] }),
      ]);
    });

    it('removes custom-prefixed entries from tier fallback_models (pricing cache would miss them)', async () => {
      const existing = makeProvider({ provider: 'custom:abc-123', is_active: true });
      providerRepo.findOne.mockResolvedValue(existing);
      providerRepo.find.mockResolvedValue([]);

      const tier = makeTier({
        override_model: null,
        fallback_models: ['custom:abc-123/gemini-2.5-flash', 'gpt-4o'],
      });
      tierRepo.find.mockResolvedValueOnce([]).mockResolvedValueOnce([tier]);
      pricingCache.getByModel.mockImplementation((model: string) => {
        if (model === 'gpt-4o') return { provider: 'OpenAI' };
        return undefined;
      });

      await service.removeProvider('agent-1', 'custom:abc-123');

      expect(tierRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ fallback_models: ['gpt-4o'] }),
      ]);
    });

    it('clears tier override when only override_model carries the custom prefix', async () => {
      const existing = makeProvider({ provider: 'custom:abc-123', is_active: true });
      providerRepo.findOne.mockResolvedValue(existing);
      providerRepo.find.mockResolvedValue([]);

      const orphanTier = makeTier({
        tier: 'standard',
        override_model: 'custom:abc-123/gemini-2.5-flash',
        override_provider: null,
      });
      tierRepo.find
        .mockResolvedValueOnce([orphanTier])
        .mockResolvedValueOnce([orphanTier])
        .mockResolvedValueOnce([makeTier({ tier: 'standard', override_model: null })]);

      const result = await service.removeProvider('agent-1', 'custom:abc-123');

      expect(tierRepo.save).toHaveBeenCalled();
      expect(result.notifications).toHaveLength(1);
    });

    it('sets specificity fallback_models to null when every entry belongs to the deleted custom provider', async () => {
      // Regression for #1603: specificity fallback list containing only orphan entries
      // should be nulled out (not kept as an empty array) so resolve() has no leftover
      // references to silently forward to the dead provider.
      const existing = makeProvider({ provider: 'custom:abc-123', is_active: true });
      providerRepo.findOne.mockResolvedValue(existing);
      providerRepo.find.mockResolvedValue([]);
      tierRepo.find.mockResolvedValue([]);

      const spec = makeSpecificity({
        override_model: null,
        fallback_models: ['custom:abc-123/gemini-2.5-flash', 'custom:abc-123/gemini-2.5-pro'],
      });
      specificityRepo.find.mockResolvedValue([spec]);

      await service.removeProvider('agent-1', 'custom:abc-123');

      expect(specificityRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ fallback_models: null }),
      ]);
    });

    it('leaves specificity rows untouched when they reference a different provider', async () => {
      const existing = makeProvider({ provider: 'custom:abc-123', is_active: true });
      providerRepo.findOne.mockResolvedValue(existing);
      providerRepo.find.mockResolvedValue([]);
      tierRepo.find.mockResolvedValue([]);

      const unrelated = makeSpecificity({
        override_model: 'anthropic/claude-opus-4',
        override_provider: 'anthropic',
        fallback_models: ['anthropic/claude-sonnet-4'],
      });
      specificityRepo.find.mockResolvedValue([unrelated]);

      await service.removeProvider('agent-1', 'custom:abc-123');

      expect(specificityRepo.save).not.toHaveBeenCalled();
    });
  });
});
