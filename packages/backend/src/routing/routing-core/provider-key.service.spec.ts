import { ProviderKeyService } from './provider-key.service';
import { RoutingCacheService } from './routing-cache.service';
import { ProviderService } from './provider.service';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import { UserProvider } from '../../entities/user-provider.entity';
import { TierAssignment } from '../../entities/tier-assignment.entity';

jest.mock('../../common/utils/crypto.util', () => ({
  decrypt: jest.fn().mockReturnValue('decrypted-key-value'),
  getEncryptionSecret: jest.fn().mockReturnValue('test-secret'),
}));

jest.mock('../../common/utils/subscription-support', () => ({
  isManifestUsableProvider: jest.fn(() => true),
}));

import { decrypt } from '../../common/utils/crypto.util';
const mockDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;

function makeMockRepo() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
  };
}

function makeProvider(overrides: Partial<UserProvider> = {}): UserProvider {
  return Object.assign(new UserProvider(), {
    id: 'prov-1',
    user_id: 'user-1',
    agent_id: 'agent-1',
    provider: 'openai',
    auth_type: 'api_key' as const,
    api_key_encrypted: 'encrypted-data',
    key_prefix: 'sk-proj-',
    is_active: true,
    connected_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    cached_models: null,
    models_fetched_at: null,
    ...overrides,
  });
}

describe('ProviderKeyService', () => {
  let service: ProviderKeyService;
  let providerRepo: ReturnType<typeof makeMockRepo>;
  let pricingCache: { getByModel: jest.Mock };
  let discoveryService: { getModelForAgent: jest.Mock };
  let routingCache: {
    getApiKey: jest.Mock;
    setApiKey: jest.Mock;
    getProviders: jest.Mock;
    setProviders: jest.Mock;
  };
  let providerService: { getProviders: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDecrypt.mockReturnValue('decrypted-key-value');
    providerRepo = makeMockRepo();
    pricingCache = { getByModel: jest.fn().mockReturnValue(undefined) };
    discoveryService = { getModelForAgent: jest.fn().mockResolvedValue(null) };
    routingCache = {
      getApiKey: jest.fn().mockReturnValue(undefined),
      setApiKey: jest.fn(),
      getProviders: jest.fn().mockReturnValue(null),
      setProviders: jest.fn(),
    };
    providerService = { getProviders: jest.fn().mockResolvedValue([]) };

    service = new ProviderKeyService(
      providerRepo as unknown as any,
      pricingCache as unknown as ModelPricingCacheService,
      discoveryService as unknown as ModelDiscoveryService,
      routingCache as unknown as RoutingCacheService,
      providerService as unknown as ProviderService,
    );
  });

  /* ── getProviderApiKey ── */

  describe('getProviderApiKey', () => {
    it('should return empty string for ollama provider', async () => {
      const result = await service.getProviderApiKey('agent-1', 'Ollama');

      expect(result).toBe('');
      expect(routingCache.getApiKey).not.toHaveBeenCalled();
    });

    it('should return cached key when available', async () => {
      routingCache.getApiKey.mockReturnValue('cached-key');

      const result = await service.getProviderApiKey('agent-1', 'openai');

      expect(result).toBe('cached-key');
      expect(providerRepo.find).not.toHaveBeenCalled();
    });

    it('should resolve and cache key from DB', async () => {
      providerRepo.find.mockResolvedValue([makeProvider()]);

      const result = await service.getProviderApiKey('agent-1', 'openai');

      expect(result).toBe('decrypted-key-value');
      expect(routingCache.setApiKey).toHaveBeenCalledWith(
        'agent-1',
        'openai',
        'decrypted-key-value',
        undefined,
      );
    });

    it('should pass authType to cache and resolver', async () => {
      providerRepo.find.mockResolvedValue([
        makeProvider({ auth_type: 'subscription', api_key_encrypted: 'enc-sub' }),
      ]);

      await service.getProviderApiKey('agent-1', 'openai', 'subscription');

      expect(routingCache.getApiKey).toHaveBeenCalledWith('agent-1', 'openai', 'subscription');
      expect(routingCache.setApiKey).toHaveBeenCalledWith(
        'agent-1',
        'openai',
        'decrypted-key-value',
        'subscription',
      );
    });

    it('should return null when no matching provider found', async () => {
      providerRepo.find.mockResolvedValue([]);

      const result = await service.getProviderApiKey('agent-1', 'openai');

      expect(result).toBeNull();
    });
  });

  /* ── resolveProviderApiKey (private, via getProviderApiKey) ── */

  describe('resolveProviderApiKey for custom: providers', () => {
    it('should handle custom provider with encrypted key', async () => {
      providerRepo.findOne.mockResolvedValue(
        makeProvider({ provider: 'custom:cp-123', api_key_encrypted: 'enc-custom' }),
      );

      const result = await service.getProviderApiKey('agent-1', 'custom:cp-123');

      expect(result).toBe('decrypted-key-value');
    });

    it('should return empty string for custom provider without key', async () => {
      providerRepo.findOne.mockResolvedValue(
        makeProvider({ provider: 'custom:cp-123', api_key_encrypted: null }),
      );

      const result = await service.getProviderApiKey('agent-1', 'custom:cp-123');

      expect(result).toBe('');
    });

    it('should return null for non-existent custom provider', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      const result = await service.getProviderApiKey('agent-1', 'custom:cp-missing');

      expect(result).toBeNull();
    });

    it('should return null when custom provider decrypt fails', async () => {
      mockDecrypt.mockImplementationOnce(() => {
        throw new Error('decrypt failed');
      });
      providerRepo.findOne.mockResolvedValue(
        makeProvider({ provider: 'custom:cp-123', api_key_encrypted: 'bad-enc' }),
      );

      const result = await service.getProviderApiKey('agent-1', 'custom:cp-123');

      expect(result).toBeNull();
    });
  });

  describe('resolveProviderApiKey with preferredAuthType', () => {
    it('should only consider matching auth type when specified', async () => {
      const apiKeyProvider = makeProvider({
        id: 'p1',
        auth_type: 'api_key',
        api_key_encrypted: 'enc-apikey',
      });
      const subProvider = makeProvider({
        id: 'p2',
        auth_type: 'subscription',
        api_key_encrypted: 'enc-sub',
      });
      providerRepo.find.mockResolvedValue([apiKeyProvider, subProvider]);

      mockDecrypt.mockImplementation((enc: string) => {
        if (enc === 'enc-sub') return 'sub-decrypted';
        return 'apikey-decrypted';
      });

      const result = await service.getProviderApiKey('agent-1', 'openai', 'subscription');

      expect(result).toBe('sub-decrypted');
    });

    it('should prefer api_key auth type when no preference specified', async () => {
      const subProvider = makeProvider({
        id: 'p2',
        auth_type: 'subscription',
        api_key_encrypted: 'enc-sub',
      });
      const apiKeyProvider = makeProvider({
        id: 'p1',
        auth_type: 'api_key',
        api_key_encrypted: 'enc-apikey',
      });
      providerRepo.find.mockResolvedValue([subProvider, apiKeyProvider]);

      mockDecrypt.mockImplementation((enc: string) => {
        if (enc === 'enc-apikey') return 'apikey-decrypted';
        return 'sub-decrypted';
      });

      const result = await service.getProviderApiKey('agent-1', 'openai');

      expect(result).toBe('apikey-decrypted');
    });

    it('should return null when decrypt fails for all candidates and log warning', async () => {
      providerRepo.find.mockResolvedValue([makeProvider({ api_key_encrypted: 'bad-enc' })]);
      mockDecrypt.mockImplementation(() => {
        throw new Error('bad key');
      });

      const result = await service.getProviderApiKey('agent-1', 'openai');

      expect(result).toBeNull();
    });

    it('should skip candidates without encrypted key', async () => {
      const noKey = makeProvider({ id: 'p1', api_key_encrypted: null });
      const withKey = makeProvider({ id: 'p2', api_key_encrypted: 'enc-valid' });
      providerRepo.find.mockResolvedValue([noKey, withKey]);

      const result = await service.getProviderApiKey('agent-1', 'openai');

      expect(result).toBe('decrypted-key-value');
    });

    it('should log subscription label when subscription decrypt fails', async () => {
      providerRepo.find.mockResolvedValue([
        makeProvider({ auth_type: 'subscription', api_key_encrypted: 'bad' }),
      ]);
      mockDecrypt.mockImplementation(() => {
        throw new Error('bad');
      });

      const result = await service.getProviderApiKey('agent-1', 'openai');

      expect(result).toBeNull();
    });
  });

  /* ── getAuthType ── */

  describe('getAuthType', () => {
    it('should return subscription when subscription record with key exists', async () => {
      providerService.getProviders.mockResolvedValue([
        makeProvider({ auth_type: 'subscription', api_key_encrypted: 'enc-sub' }),
      ]);

      const result = await service.getAuthType('agent-1', 'openai');

      expect(result).toBe('subscription');
    });

    it('should return api_key when subscription has no key but api_key has key', async () => {
      providerService.getProviders.mockResolvedValue([
        makeProvider({ auth_type: 'subscription', api_key_encrypted: null }),
        makeProvider({ id: 'p2', auth_type: 'api_key', api_key_encrypted: 'enc' }),
      ]);

      const result = await service.getAuthType('agent-1', 'openai');

      expect(result).toBe('api_key');
    });

    it('should return first match auth_type when no records have keys', async () => {
      providerService.getProviders.mockResolvedValue([
        makeProvider({ auth_type: 'subscription', api_key_encrypted: null }),
      ]);

      const result = await service.getAuthType('agent-1', 'openai');

      expect(result).toBe('subscription');
    });

    it('should return api_key as default when no providers match', async () => {
      providerService.getProviders.mockResolvedValue([]);

      const result = await service.getAuthType('agent-1', 'openai');

      expect(result).toBe('api_key');
    });

    it('should expand provider aliases when matching', async () => {
      providerService.getProviders.mockResolvedValue([
        makeProvider({ provider: 'google', api_key_encrypted: 'enc', auth_type: 'api_key' }),
      ]);

      const result = await service.getAuthType('agent-1', 'gemini');

      expect(result).toBe('api_key');
    });

    it('should return api_key when subscription is excluded and both exist', async () => {
      providerService.getProviders.mockResolvedValue([
        makeProvider({ id: 'p1', auth_type: 'subscription', api_key_encrypted: 'enc-sub' }),
        makeProvider({ id: 'p2', auth_type: 'api_key', api_key_encrypted: 'enc-api' }),
      ]);

      const result = await service.getAuthType('agent-1', 'openai', new Set(['subscription']));

      expect(result).toBe('api_key');
    });

    it('should return subscription when api_key is excluded and both exist', async () => {
      providerService.getProviders.mockResolvedValue([
        makeProvider({ id: 'p1', auth_type: 'subscription', api_key_encrypted: 'enc-sub' }),
        makeProvider({ id: 'p2', auth_type: 'api_key', api_key_encrypted: 'enc-api' }),
      ]);

      const result = await service.getAuthType('agent-1', 'openai', new Set(['api_key']));

      expect(result).toBe('subscription');
    });

    it('should fall through to default when all auth types excluded', async () => {
      providerService.getProviders.mockResolvedValue([
        makeProvider({ id: 'p1', auth_type: 'subscription', api_key_encrypted: 'enc-sub' }),
        makeProvider({ id: 'p2', auth_type: 'api_key', api_key_encrypted: 'enc-api' }),
      ]);

      const result = await service.getAuthType(
        'agent-1',
        'openai',
        new Set(['subscription', 'api_key']),
      );

      // Falls through because filtered set is empty — original logic applies
      expect(result).toBe('subscription');
    });

    it('should ignore exclusions when only one auth type exists', async () => {
      providerService.getProviders.mockResolvedValue([
        makeProvider({ id: 'p1', auth_type: 'api_key', api_key_encrypted: 'enc-api' }),
      ]);

      const result = await service.getAuthType('agent-1', 'openai', new Set(['api_key']));

      // Falls through because filtering leaves empty set
      expect(result).toBe('api_key');
    });

    it('should behave the same with empty exclusion set', async () => {
      providerService.getProviders.mockResolvedValue([
        makeProvider({ id: 'p1', auth_type: 'subscription', api_key_encrypted: 'enc-sub' }),
        makeProvider({ id: 'p2', auth_type: 'api_key', api_key_encrypted: 'enc-api' }),
      ]);

      const result = await service.getAuthType('agent-1', 'openai', new Set());

      // Empty set has size 0, so exclusion logic is skipped — defaults to subscription
      expect(result).toBe('subscription');
    });

    it('should return local for Ollama providers', async () => {
      providerService.getProviders.mockResolvedValue([
        makeProvider({
          provider: 'ollama',
          auth_type: 'local',
          api_key_encrypted: null,
        }),
      ]);

      const result = await service.getAuthType('agent-1', 'ollama');

      expect(result).toBe('local');
    });

    it('should return local for LM Studio providers', async () => {
      providerService.getProviders.mockResolvedValue([
        makeProvider({
          provider: 'lmstudio',
          auth_type: 'local',
          api_key_encrypted: null,
        }),
      ]);

      const result = await service.getAuthType('agent-1', 'lmstudio');

      expect(result).toBe('local');
    });

    it('trusts the row auth_type — does NOT override api_key → local by provider name alone', async () => {
      // A row explicitly tagged api_key for 'ollama' (e.g. a user who
      // hand-edited the DB) should not be silently retagged as local.
      // Migrations handle the normal backfill; this service just reads.
      providerService.getProviders.mockResolvedValue([
        makeProvider({
          provider: 'ollama',
          auth_type: 'api_key',
          api_key_encrypted: 'enc',
        }),
      ]);

      const result = await service.getAuthType('agent-1', 'ollama');

      expect(result).toBe('api_key');
    });
  });

  /* ── hasActiveProvider ── */

  describe('hasActiveProvider', () => {
    it('should return true when active provider exists', async () => {
      providerService.getProviders.mockResolvedValue([
        makeProvider({ provider: 'anthropic', is_active: true }),
      ]);

      expect(await service.hasActiveProvider('agent-1', 'anthropic')).toBe(true);
    });

    it('should return false when provider is inactive', async () => {
      providerService.getProviders.mockResolvedValue([
        makeProvider({ provider: 'anthropic', is_active: false }),
      ]);

      expect(await service.hasActiveProvider('agent-1', 'anthropic')).toBe(false);
    });

    it('should return false when provider does not exist', async () => {
      providerService.getProviders.mockResolvedValue([]);

      expect(await service.hasActiveProvider('agent-1', 'anthropic')).toBe(false);
    });

    it('should handle provider aliases (gemini/google)', async () => {
      providerService.getProviders.mockResolvedValue([
        makeProvider({ provider: 'google', is_active: true }),
      ]);

      expect(await service.hasActiveProvider('agent-1', 'gemini')).toBe(true);
    });
  });

  /* ── findProviderForModel ── */

  describe('findProviderForModel', () => {
    it('should return provider when model found in cached_models', async () => {
      providerService.getProviders.mockResolvedValue([
        makeProvider({
          provider: 'openai',
          cached_models: [{ id: 'gpt-4o' }] as any[],
        }),
      ]);

      const result = await service.findProviderForModel('agent-1', 'gpt-4o');

      expect(result).toBe('openai');
    });

    it('should return undefined when model not found', async () => {
      providerService.getProviders.mockResolvedValue([
        makeProvider({ provider: 'openai', cached_models: [{ id: 'gpt-3.5' }] as any[] }),
      ]);

      const result = await service.findProviderForModel('agent-1', 'gpt-4o');

      expect(result).toBeUndefined();
    });

    it('should skip providers with null cached_models', async () => {
      providerService.getProviders.mockResolvedValue([
        makeProvider({ provider: 'openai', cached_models: null }),
      ]);

      const result = await service.findProviderForModel('agent-1', 'gpt-4o');

      expect(result).toBeUndefined();
    });
  });

  /* ── getEffectiveModel ── */

  describe('getEffectiveModel', () => {
    it('should return override model when available and model is available', async () => {
      discoveryService.getModelForAgent.mockResolvedValue({ id: 'gpt-4o' });
      const assignment = {
        override_model: 'gpt-4o',
        auto_assigned_model: 'gpt-3.5',
        tier: 'simple',
      } as TierAssignment;

      const result = await service.getEffectiveModel('agent-1', assignment);

      expect(result).toBe('gpt-4o');
    });

    it('should fall through to auto when override model is not available', async () => {
      discoveryService.getModelForAgent.mockResolvedValue(null);
      providerRepo.find.mockResolvedValue([]);
      pricingCache.getByModel.mockReturnValue(undefined);
      const assignment = {
        override_model: 'gpt-4o',
        auto_assigned_model: 'gpt-3.5',
        tier: 'simple',
      } as TierAssignment;

      const result = await service.getEffectiveModel('agent-1', assignment);

      expect(result).toBe('gpt-3.5');
    });

    it('should return auto_assigned_model when no override', async () => {
      const assignment = {
        override_model: null,
        auto_assigned_model: 'gpt-3.5',
        tier: 'simple',
      } as TierAssignment;

      const result = await service.getEffectiveModel('agent-1', assignment);

      expect(result).toBe('gpt-3.5');
    });

    it('should return null when auto_assigned_model is null', async () => {
      const assignment = {
        override_model: null,
        auto_assigned_model: null,
        tier: 'simple',
      } as TierAssignment;

      const result = await service.getEffectiveModel('agent-1', assignment);

      expect(result).toBeNull();
    });
  });

  /* ── isModelAvailable (private, via getEffectiveModel) ── */

  describe('isModelAvailable (via getEffectiveModel)', () => {
    it('should return true when model is discovered', async () => {
      discoveryService.getModelForAgent.mockResolvedValue({ id: 'gpt-4o' });
      const assignment = {
        override_model: 'gpt-4o',
        auto_assigned_model: null,
        tier: 'simple',
      } as TierAssignment;

      const result = await service.getEffectiveModel('agent-1', assignment);

      expect(result).toBe('gpt-4o');
    });

    it('should match via pricing provider names', async () => {
      discoveryService.getModelForAgent.mockResolvedValue(null);
      pricingCache.getByModel.mockReturnValue({ provider: 'OpenAI', model_name: 'gpt-4o' });
      providerRepo.find.mockResolvedValue([makeProvider({ provider: 'openai' })]);
      const assignment = {
        override_model: 'gpt-4o',
        auto_assigned_model: null,
        tier: 'simple',
      } as TierAssignment;

      const result = await service.getEffectiveModel('agent-1', assignment);

      expect(result).toBe('gpt-4o');
    });

    it('should match via model name prefix inference from pricing', async () => {
      discoveryService.getModelForAgent.mockResolvedValue(null);
      pricingCache.getByModel.mockReturnValue({
        provider: 'SomeProvider',
        model_name: 'openai/gpt-4o',
      });
      // No direct match on "someprovider"
      providerRepo.find.mockResolvedValue([makeProvider({ provider: 'openai' })]);
      const assignment = {
        override_model: 'gpt-4o',
        auto_assigned_model: null,
        tier: 'simple',
      } as TierAssignment;

      const result = await service.getEffectiveModel('agent-1', assignment);

      expect(result).toBe('gpt-4o');
    });

    it('should match via model name prefix inference when no pricing exists', async () => {
      discoveryService.getModelForAgent.mockResolvedValue(null);
      pricingCache.getByModel.mockReturnValue(undefined);
      providerRepo.find.mockResolvedValue([makeProvider({ provider: 'anthropic' })]);
      const assignment = {
        override_model: 'anthropic/claude-sonnet-4',
        auto_assigned_model: null,
        tier: 'simple',
      } as TierAssignment;

      const result = await service.getEffectiveModel('agent-1', assignment);

      expect(result).toBe('anthropic/claude-sonnet-4');
    });

    it('should return false (fall to auto) when model not available anywhere', async () => {
      discoveryService.getModelForAgent.mockResolvedValue(null);
      pricingCache.getByModel.mockReturnValue(undefined);
      providerRepo.find.mockResolvedValue([makeProvider({ provider: 'anthropic' })]);
      const assignment = {
        override_model: 'nonexistent-model',
        auto_assigned_model: 'claude-3-haiku',
        tier: 'simple',
      } as TierAssignment;

      const result = await service.getEffectiveModel('agent-1', assignment);

      expect(result).toBe('claude-3-haiku');
    });
  });
});
