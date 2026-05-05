import type { Repository } from 'typeorm';
import type { ModelRoute } from 'manifest-shared';
import { ProviderKeyService } from '../provider-key.service';
import { UserProvider } from '../../../entities/user-provider.entity';
import { TierAssignment } from '../../../entities/tier-assignment.entity';
import type { ModelPricingCacheService } from '../../../model-prices/model-pricing-cache.service';
import type { ModelDiscoveryService } from '../../../model-discovery/model-discovery.service';
import type { RoutingCacheService } from '../routing-cache.service';
import type { ProviderService } from '../provider.service';

// Mock the crypto util so tests can drive decrypt success/failure deterministically.
jest.mock('../../../common/utils/crypto.util', () => ({
  decrypt: jest.fn(),
  encrypt: jest.fn(),
  getEncryptionSecret: jest.fn(() => 'a'.repeat(64)),
}));

import { decrypt } from '../../../common/utils/crypto.util';
const mockedDecrypt = decrypt as jest.MockedFunction<typeof decrypt>;

const route = (provider: string, authType: ModelRoute['authType'], model: string): ModelRoute => ({
  provider,
  authType,
  model,
});

describe('ProviderKeyService', () => {
  let providerRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
  };
  let pricingCache: jest.Mocked<Pick<ModelPricingCacheService, 'getByModel'>>;
  let discoveryService: jest.Mocked<Pick<ModelDiscoveryService, 'getModelForAgent'>>;
  let routingCache: {
    getApiKey: jest.Mock;
    setApiKey: jest.Mock;
  };
  let providerService: jest.Mocked<Pick<ProviderService, 'getProviders'>>;
  let svc: ProviderKeyService;

  beforeEach(() => {
    jest.clearAllMocks();
    providerRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    pricingCache = { getByModel: jest.fn().mockReturnValue(undefined) };
    discoveryService = { getModelForAgent: jest.fn().mockResolvedValue(undefined) };
    routingCache = {
      getApiKey: jest.fn().mockReturnValue(undefined),
      setApiKey: jest.fn(),
    };
    providerService = { getProviders: jest.fn().mockResolvedValue([]) };

    svc = new ProviderKeyService(
      providerRepo as unknown as Repository<UserProvider>,
      pricingCache as unknown as ModelPricingCacheService,
      discoveryService as unknown as ModelDiscoveryService,
      routingCache as unknown as RoutingCacheService,
      providerService as unknown as ProviderService,
    );
  });

  describe('getProviderApiKey', () => {
    it('returns empty string for ollama without consulting cache or repo', async () => {
      const result = await svc.getProviderApiKey('agent-1', 'ollama');
      expect(result).toBe('');
      expect(routingCache.getApiKey).not.toHaveBeenCalled();
    });

    it('returns the cached value when present', async () => {
      routingCache.getApiKey.mockReturnValue('cached-key');
      const result = await svc.getProviderApiKey('agent-1', 'openai');
      expect(result).toBe('cached-key');
      expect(providerRepo.find).not.toHaveBeenCalled();
    });

    it('caches the resolved key after lookup', async () => {
      routingCache.getApiKey.mockReturnValue(undefined);
      providerRepo.find.mockResolvedValue([
        {
          provider: 'openai',
          auth_type: 'api_key',
          api_key_encrypted: 'enc',
          is_active: true,
        },
      ]);
      mockedDecrypt.mockReturnValue('plaintext-key');

      const result = await svc.getProviderApiKey('agent-1', 'openai');
      expect(result).toBe('plaintext-key');
      expect(routingCache.setApiKey).toHaveBeenCalledWith(
        'agent-1',
        'openai',
        'plaintext-key',
        undefined,
      );
    });
  });

  describe('resolveProviderApiKey via getProviderApiKey', () => {
    it('returns null for a missing custom provider', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      const result = await svc.getProviderApiKey('agent-1', 'custom:abc');
      expect(result).toBeNull();
    });

    it('returns empty string for a custom provider without an encrypted key', async () => {
      providerRepo.findOne.mockResolvedValue({
        provider: 'custom:abc',
        api_key_encrypted: null,
      });
      const result = await svc.getProviderApiKey('agent-1', 'custom:abc');
      expect(result).toBe('');
    });

    it('decrypts a custom provider key', async () => {
      providerRepo.findOne.mockResolvedValue({
        provider: 'custom:abc',
        api_key_encrypted: 'enc',
      });
      mockedDecrypt.mockReturnValue('decrypted');
      const result = await svc.getProviderApiKey('agent-1', 'custom:abc');
      expect(result).toBe('decrypted');
    });

    it('returns null when custom provider key fails to decrypt', async () => {
      providerRepo.findOne.mockResolvedValue({
        provider: 'custom:abc',
        api_key_encrypted: 'enc',
      });
      mockedDecrypt.mockImplementation(() => {
        throw new Error('bad cipher');
      });
      const result = await svc.getProviderApiKey('agent-1', 'custom:abc');
      expect(result).toBeNull();
    });

    it('returns null when no provider records match', async () => {
      providerRepo.find.mockResolvedValue([]);
      const result = await svc.getProviderApiKey('agent-1', 'openai');
      expect(result).toBeNull();
    });

    it('prefers api_key over subscription when no preferred auth type given', async () => {
      providerRepo.find.mockResolvedValue([
        {
          provider: 'openai',
          auth_type: 'subscription',
          api_key_encrypted: 'enc-sub',
          is_active: true,
        },
        {
          provider: 'openai',
          auth_type: 'api_key',
          api_key_encrypted: 'enc-key',
          is_active: true,
        },
      ]);
      mockedDecrypt.mockImplementation((cipher) =>
        cipher === 'enc-key' ? 'plaintext-key' : 'plaintext-sub',
      );

      const result = await svc.getProviderApiKey('agent-1', 'openai');
      expect(result).toBe('plaintext-key');
    });

    it('honors a preferred auth type filter', async () => {
      providerRepo.find.mockResolvedValue([
        {
          provider: 'openai',
          auth_type: 'subscription',
          api_key_encrypted: 'enc-sub',
          is_active: true,
        },
        {
          provider: 'openai',
          auth_type: 'api_key',
          api_key_encrypted: 'enc-key',
          is_active: true,
        },
      ]);
      mockedDecrypt.mockImplementation((cipher) =>
        cipher === 'enc-key' ? 'plaintext-key' : 'plaintext-sub',
      );

      const result = await svc.getProviderApiKey('agent-1', 'openai', 'subscription');
      expect(result).toBe('plaintext-sub');
    });

    it('skips records without an encrypted key', async () => {
      providerRepo.find.mockResolvedValue([
        {
          provider: 'openai',
          auth_type: 'api_key',
          api_key_encrypted: null,
          is_active: true,
        },
      ]);

      const result = await svc.getProviderApiKey('agent-1', 'openai');
      expect(result).toBeNull();
    });

    it('moves to the next record when a key fails to decrypt', async () => {
      providerRepo.find.mockResolvedValue([
        {
          provider: 'openai',
          auth_type: 'api_key',
          api_key_encrypted: 'broken',
          is_active: true,
        },
        {
          provider: 'openai',
          auth_type: 'subscription',
          api_key_encrypted: 'good',
          is_active: true,
        },
      ]);
      mockedDecrypt.mockImplementation((cipher) => {
        if (cipher === 'broken') throw new Error('bad cipher');
        return 'real-key';
      });

      const result = await svc.getProviderApiKey('agent-1', 'openai');
      expect(result).toBe('real-key');
    });
  });

  describe('getAuthType', () => {
    it('returns "local" when a local record matches', async () => {
      providerService.getProviders.mockResolvedValue([
        {
          provider: 'openai',
          auth_type: 'local',
          is_active: true,
          api_key_encrypted: null,
        } as UserProvider,
      ]);
      expect(await svc.getAuthType('agent-1', 'openai')).toBe('local');
    });

    it('returns "subscription" when a subscription record with key exists', async () => {
      providerService.getProviders.mockResolvedValue([
        {
          provider: 'openai',
          auth_type: 'subscription',
          is_active: true,
          api_key_encrypted: 'enc',
        } as UserProvider,
        {
          provider: 'openai',
          auth_type: 'api_key',
          is_active: true,
          api_key_encrypted: 'enc-2',
        } as UserProvider,
      ]);
      expect(await svc.getAuthType('agent-1', 'openai')).toBe('subscription');
    });

    it('falls back to api_key when subscription has no key', async () => {
      providerService.getProviders.mockResolvedValue([
        {
          provider: 'openai',
          auth_type: 'subscription',
          is_active: true,
          api_key_encrypted: null,
        } as UserProvider,
        {
          provider: 'openai',
          auth_type: 'api_key',
          is_active: true,
          api_key_encrypted: 'enc',
        } as UserProvider,
      ]);
      expect(await svc.getAuthType('agent-1', 'openai')).toBe('api_key');
    });

    it('returns the first record auth_type when none have keys', async () => {
      providerService.getProviders.mockResolvedValue([
        {
          provider: 'openai',
          auth_type: 'subscription',
          is_active: true,
          api_key_encrypted: null,
        } as UserProvider,
      ]);
      expect(await svc.getAuthType('agent-1', 'openai')).toBe('subscription');
    });

    it('defaults to api_key when no records match', async () => {
      providerService.getProviders.mockResolvedValue([]);
      expect(await svc.getAuthType('agent-1', 'openai')).toBe('api_key');
    });

    it('honors excludeAuthTypes when alternate matches exist', async () => {
      providerService.getProviders.mockResolvedValue([
        {
          provider: 'openai',
          auth_type: 'api_key',
          is_active: true,
          api_key_encrypted: 'enc-key',
        } as UserProvider,
        {
          provider: 'openai',
          auth_type: 'subscription',
          is_active: true,
          api_key_encrypted: 'enc-sub',
        } as UserProvider,
      ]);
      const excluded = new Set(['api_key']);
      expect(await svc.getAuthType('agent-1', 'openai', excluded)).toBe('subscription');
    });

    it('ignores excludeAuthTypes when filtering would leave no records', async () => {
      providerService.getProviders.mockResolvedValue([
        {
          provider: 'openai',
          auth_type: 'api_key',
          is_active: true,
          api_key_encrypted: 'enc-key',
        } as UserProvider,
      ]);
      const excluded = new Set(['api_key']);
      expect(await svc.getAuthType('agent-1', 'openai', excluded)).toBe('api_key');
    });
  });

  describe('hasActiveProvider', () => {
    it('returns true when an active provider record matches', async () => {
      providerService.getProviders.mockResolvedValue([
        { provider: 'openai', is_active: true } as UserProvider,
      ]);
      expect(await svc.hasActiveProvider('agent-1', 'openai')).toBe(true);
    });

    it('returns false when no record is active', async () => {
      providerService.getProviders.mockResolvedValue([]);
      expect(await svc.hasActiveProvider('agent-1', 'openai')).toBe(false);
    });
  });

  describe('getProviderRegion', () => {
    it('returns the region of the matched record', async () => {
      providerService.getProviders.mockResolvedValue([
        {
          provider: 'qwen',
          auth_type: 'api_key',
          is_active: true,
          region: 'singapore',
        } as UserProvider,
      ]);
      expect(await svc.getProviderRegion('agent-1', 'qwen', 'api_key')).toBe('singapore');
    });

    it('returns the first record when no auth type filter is given', async () => {
      providerService.getProviders.mockResolvedValue([
        { provider: 'qwen', auth_type: 'api_key', is_active: true, region: 'us' } as UserProvider,
      ]);
      expect(await svc.getProviderRegion('agent-1', 'qwen')).toBe('us');
    });

    it('returns null when no match', async () => {
      providerService.getProviders.mockResolvedValue([]);
      expect(await svc.getProviderRegion('agent-1', 'qwen')).toBeNull();
    });
  });

  describe('findProviderForModel', () => {
    it('returns the provider whose cached_models contain the model', async () => {
      providerService.getProviders.mockResolvedValue([
        { provider: 'openai', cached_models: [{ id: 'gpt-4o' }] } as unknown as UserProvider,
        { provider: 'anthropic', cached_models: [{ id: 'claude' }] } as unknown as UserProvider,
      ]);
      expect(await svc.findProviderForModel('agent-1', 'claude')).toBe('anthropic');
    });

    it('returns undefined when no provider lists the model', async () => {
      providerService.getProviders.mockResolvedValue([
        { provider: 'openai', cached_models: [{ id: 'gpt-4o' }] } as unknown as UserProvider,
      ]);
      expect(await svc.findProviderForModel('agent-1', 'missing')).toBeUndefined();
    });

    it('skips providers without cached_models', async () => {
      providerService.getProviders.mockResolvedValue([
        { provider: 'no-cache', cached_models: null } as unknown as UserProvider,
      ]);
      expect(await svc.findProviderForModel('agent-1', 'anything')).toBeUndefined();
    });
  });

  describe('getEffectiveModel', () => {
    it('returns the override model when available', async () => {
      const assignment = {
        agent_id: 'agent-1',
        tier: 'standard',
        override_route: route('openai', 'api_key', 'gpt-4o'),
        auto_assigned_route: route('openai', 'api_key', 'auto-model'),
      } as unknown as TierAssignment;

      // Make the override model available.
      discoveryService.getModelForAgent.mockResolvedValue({ id: 'gpt-4o' } as never);

      expect(await svc.getEffectiveModel('agent-1', assignment)).toBe('gpt-4o');
    });

    it('falls through to auto when override is unavailable', async () => {
      const assignment = {
        agent_id: 'agent-1',
        tier: 'standard',
        override_route: route('openai', 'api_key', 'gpt-4o'),
        auto_assigned_route: route('openai', 'api_key', 'auto-model'),
      } as unknown as TierAssignment;

      // override and auto both fail discovery + pricing — but isModelAvailable
      // also checks records by provider; ensure none match so we test pure
      // fallthrough.
      discoveryService.getModelForAgent.mockResolvedValue(undefined);
      pricingCache.getByModel.mockReturnValue(undefined);
      providerRepo.find.mockResolvedValue([]);

      const result = await svc.getEffectiveModel('agent-1', assignment);
      expect(result).toBe('auto-model');
    });

    it('returns null when both override and auto are null', async () => {
      const assignment = {
        agent_id: 'agent-1',
        tier: 'standard',
        override_route: null,
        auto_assigned_route: null,
      } as unknown as TierAssignment;

      const result = await svc.getEffectiveModel('agent-1', assignment);
      expect(result).toBeNull();
    });

    it('returns the auto model when override is null', async () => {
      const assignment = {
        agent_id: 'agent-1',
        tier: 'standard',
        override_route: null,
        auto_assigned_route: route('openai', 'api_key', 'auto-model'),
      } as unknown as TierAssignment;

      const result = await svc.getEffectiveModel('agent-1', assignment);
      expect(result).toBe('auto-model');
    });
  });

  describe('isModelAvailable', () => {
    it('returns true when the model is in the discovered cache', async () => {
      discoveryService.getModelForAgent.mockResolvedValue({ id: 'gpt-4o' } as never);
      expect(await svc.isModelAvailable('agent-1', 'gpt-4o')).toBe(true);
    });

    it('returns true when pricing maps to a connected provider', async () => {
      pricingCache.getByModel.mockReturnValue({
        provider: 'openai',
        model_name: 'gpt-4o',
      } as never);
      providerRepo.find.mockResolvedValue([
        { provider: 'openai', auth_type: 'api_key', is_active: true } as UserProvider,
      ]);
      expect(await svc.isModelAvailable('agent-1', 'gpt-4o')).toBe(true);
    });

    it('returns true when the prefix matches a connected provider', async () => {
      providerRepo.find.mockResolvedValue([
        { provider: 'anthropic', auth_type: 'api_key', is_active: true } as UserProvider,
      ]);
      expect(await svc.isModelAvailable('agent-1', 'anthropic/claude')).toBe(true);
    });

    it('always returns false for qwen models without native discovery', async () => {
      pricingCache.getByModel.mockReturnValue({
        provider: 'qwen',
        model_name: 'qwen-max',
      } as never);
      providerRepo.find.mockResolvedValue([
        { provider: 'qwen', auth_type: 'api_key', is_active: true } as UserProvider,
      ]);
      expect(await svc.isModelAvailable('agent-1', 'qwen-max')).toBe(false);
    });

    it('returns false when nothing matches', async () => {
      providerRepo.find.mockResolvedValue([]);
      expect(await svc.isModelAvailable('agent-1', 'mystery-model')).toBe(false);
    });

    it('returns true when canonical prefix maps to a connected provider', async () => {
      pricingCache.getByModel.mockReturnValue({
        provider: 'OpenRouter',
        model_name: 'openai/gpt-4o',
      } as never);
      providerRepo.find.mockResolvedValue([
        { provider: 'openai', auth_type: 'api_key', is_active: true } as UserProvider,
      ]);
      expect(await svc.isModelAvailable('agent-1', 'gpt-4o')).toBe(true);
    });
  });
});
