import { ResolveService } from './resolve/resolve.service';
import { TierService } from './routing-core/tier.service';
import { ProviderKeyService } from './routing-core/provider-key.service';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { ModelDiscoveryService } from '../model-discovery/model-discovery.service';

describe('ResolveService', () => {
  let service: ResolveService;
  let mockTierService: Record<string, jest.Mock>;
  let mockProviderKeyService: Record<string, jest.Mock>;
  let mockPricingCache: Record<string, jest.Mock>;
  let mockDiscoveryService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockTierService = {
      getTiers: jest.fn().mockResolvedValue([
        { tier: 'simple', override_model: null, auto_assigned_model: 'gpt-4o-mini' },
        { tier: 'standard', override_model: null, auto_assigned_model: 'gpt-4o' },
        { tier: 'complex', override_model: null, auto_assigned_model: 'claude-sonnet-4' },
        { tier: 'reasoning', override_model: null, auto_assigned_model: 'claude-opus-4-6' },
      ]),
    };
    mockProviderKeyService = {
      getEffectiveModel: jest.fn(),
      getAuthType: jest.fn().mockResolvedValue('api_key'),
    };
    mockPricingCache = {
      getByModel: jest.fn(),
    };
    mockDiscoveryService = {
      getModelForAgent: jest.fn().mockResolvedValue(undefined),
    };

    service = new ResolveService(
      mockTierService as unknown as TierService,
      mockProviderKeyService as unknown as ProviderKeyService,
      mockPricingCache as unknown as ModelPricingCacheService,
      mockDiscoveryService as unknown as ModelDiscoveryService,
    );
  });

  it('should return simple tier for short message', async () => {
    mockProviderKeyService.getEffectiveModel.mockResolvedValue('gpt-4o-mini');
    mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });

    const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

    expect(result.tier).toBe('simple');
    expect(result.model).toBe('gpt-4o-mini');
    expect(result.provider).toBe('OpenAI');
    expect(result.auth_type).toBe('api_key');
    expect(result.reason).toBe('short_message');
  });

  it('should return null model when no effective model available', async () => {
    mockProviderKeyService.getEffectiveModel.mockResolvedValue(null);

    const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

    expect(result.tier).toBe('simple');
    expect(result.model).toBeNull();
    expect(result.provider).toBeNull();
  });

  it('should return null model when no tier assignment found', async () => {
    mockTierService.getTiers.mockResolvedValue([]);

    const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

    expect(result.model).toBeNull();
    expect(result.provider).toBeNull();
  });

  it('should resolve complex tier for elaborate messages', async () => {
    mockProviderKeyService.getEffectiveModel.mockResolvedValue('claude-sonnet-4');
    mockPricingCache.getByModel.mockReturnValue({ provider: 'Anthropic' });

    const messages = [
      {
        role: 'user',
        content:
          'Please write a comprehensive analysis of the trade-offs between microservices and monolithic architecture. ' +
          'Include sections on deployment complexity, data consistency, team organization, performance implications, ' +
          'and provide code examples for service communication patterns. Also compare event-driven vs request-response ' +
          'approaches with specific implementation recommendations for a team of 50 engineers.',
      },
    ];

    const result = await service.resolve('agent-1', messages);

    expect(['complex', 'standard', 'reasoning']).toContain(result.tier);
    expect(result.model).toBe('claude-sonnet-4');
  });

  it('should pass momentum (recentTiers) to scorer', async () => {
    mockProviderKeyService.getEffectiveModel.mockResolvedValue('gpt-4o');
    mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });

    const result = await service.resolve(
      'agent-1',
      [{ role: 'user', content: 'continue' }],
      undefined,
      undefined,
      undefined,
      ['complex', 'complex', 'complex'],
    );

    // Momentum should bias toward complex, so we should not get 'simple'
    expect(result.tier).not.toBe('simple');
  });

  it('should return null provider when pricing not found', async () => {
    mockProviderKeyService.getEffectiveModel.mockResolvedValue('unknown-model');
    mockPricingCache.getByModel.mockReturnValue(undefined);

    const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

    expect(result.model).toBe('unknown-model');
    expect(result.provider).toBeNull();
  });

  describe('resolveForTier', () => {
    it('should return model for an assigned tier', async () => {
      mockProviderKeyService.getEffectiveModel.mockResolvedValue('gpt-4o-mini');
      mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });

      const result = await service.resolveForTier('agent-1', 'simple');

      expect(result.tier).toBe('simple');
      expect(result.model).toBe('gpt-4o-mini');
      expect(result.provider).toBe('OpenAI');
      expect(result.confidence).toBe(1);
      expect(result.score).toBe(0);
      expect(result.reason).toBe('heartbeat');
    });

    it('should return null model when tier has no assignment', async () => {
      mockTierService.getTiers.mockResolvedValue([]);

      const result = await service.resolveForTier('agent-1', 'simple');

      expect(result.tier).toBe('simple');
      expect(result.model).toBeNull();
      expect(result.provider).toBeNull();
      expect(result.reason).toBe('heartbeat');
    });

    it('should return null model when effective model is null', async () => {
      mockProviderKeyService.getEffectiveModel.mockResolvedValue(null);

      const result = await service.resolveForTier('agent-1', 'simple');

      expect(result.tier).toBe('simple');
      expect(result.model).toBeNull();
      expect(result.provider).toBeNull();
    });
  });

  it('should log available tiers when no assignment matches scored tier', async () => {
    // Set up tiers that do NOT include the scored tier (simple).
    // scoreRequest returns 'simple' for short messages but we only provide 'complex'.
    mockTierService.getTiers.mockResolvedValue([
      { tier: 'complex', override_model: null, auto_assigned_model: 'claude-sonnet-4' },
    ]);

    const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

    expect(result.model).toBeNull();
    expect(result.provider).toBeNull();
    expect(result.tier).toBe('simple');
  });

  describe('auth_type resolution', () => {
    it('should prefer stored override_provider over model prefix inference', async () => {
      mockTierService.getTiers.mockResolvedValue([
        {
          tier: 'simple',
          override_model: 'z-ai/glm-5',
          override_provider: 'openrouter',
          override_auth_type: 'api_key',
          auto_assigned_model: 'gpt-4o-mini',
        },
        { tier: 'standard', override_model: null, auto_assigned_model: 'gpt-4o' },
        { tier: 'complex', override_model: null, auto_assigned_model: 'claude-sonnet-4' },
        { tier: 'reasoning', override_model: null, auto_assigned_model: 'claude-opus-4-6' },
      ]);
      mockProviderKeyService.getEffectiveModel.mockResolvedValue('z-ai/glm-5');

      const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

      expect(result.provider).toBe('openrouter');
      expect(mockDiscoveryService.getModelForAgent).not.toHaveBeenCalled();
      expect(mockPricingCache.getByModel).not.toHaveBeenCalled();
    });

    it('should propagate override_auth_type from tier assignment', async () => {
      mockTierService.getTiers.mockResolvedValue([
        {
          tier: 'simple',
          override_model: 'claude-sonnet-4',
          override_auth_type: 'subscription',
          auto_assigned_model: 'gpt-4o-mini',
        },
        { tier: 'standard', override_model: null, auto_assigned_model: 'gpt-4o' },
        { tier: 'complex', override_model: null, auto_assigned_model: 'claude-sonnet-4' },
        { tier: 'reasoning', override_model: null, auto_assigned_model: 'claude-opus-4-6' },
      ]);
      mockProviderKeyService.getEffectiveModel.mockResolvedValue('claude-sonnet-4');
      mockPricingCache.getByModel.mockReturnValue({ provider: 'Anthropic' });

      const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

      expect(result.auth_type).toBe('subscription');
      // getAuthType should NOT be called when override_auth_type is set
      expect(mockProviderKeyService.getAuthType).not.toHaveBeenCalled();
    });

    it('should fall back to getAuthType when no override_auth_type', async () => {
      mockTierService.getTiers.mockResolvedValue([
        {
          tier: 'simple',
          override_model: null,
          override_auth_type: null,
          auto_assigned_model: 'gpt-4o-mini',
        },
        { tier: 'standard', override_model: null, auto_assigned_model: 'gpt-4o' },
        { tier: 'complex', override_model: null, auto_assigned_model: 'claude-sonnet-4' },
        { tier: 'reasoning', override_model: null, auto_assigned_model: 'claude-opus-4-6' },
      ]);
      mockProviderKeyService.getEffectiveModel.mockResolvedValue('gpt-4o-mini');
      mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });
      mockProviderKeyService.getAuthType.mockResolvedValue('api_key');

      const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

      expect(result.auth_type).toBe('api_key');
      expect(mockProviderKeyService.getAuthType).toHaveBeenCalledWith('agent-1', 'OpenAI');
    });

    it('should return subscription from getAuthType when provider has subscription', async () => {
      mockProviderKeyService.getEffectiveModel.mockResolvedValue('claude-sonnet-4');
      mockPricingCache.getByModel.mockReturnValue({ provider: 'Anthropic' });
      mockProviderKeyService.getAuthType.mockResolvedValue('subscription');

      const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

      expect(result.auth_type).toBe('subscription');
    });

    it('should not include auth_type when provider is null', async () => {
      mockProviderKeyService.getEffectiveModel.mockResolvedValue(null);

      const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

      expect(result.auth_type).toBeUndefined();
      expect(mockProviderKeyService.getAuthType).not.toHaveBeenCalled();
    });
  });

  describe('resolveForTier provider inference fallback', () => {
    it('should use pricing.provider when model has no prefix', async () => {
      mockTierService.getTiers.mockResolvedValue([
        { tier: 'simple', override_model: null, auto_assigned_model: 'gpt-4o-mini' },
      ]);
      mockProviderKeyService.getEffectiveModel.mockResolvedValue('gpt-4o-mini');
      // model 'gpt-4o-mini' has no slash → inferProviderFromModelName returns undefined
      // pricing.provider has the display name from the cache
      mockPricingCache.getByModel.mockReturnValue({
        model_name: 'openai/gpt-4o-mini',
        provider: 'OpenAI',
      });

      const result = await service.resolveForTier('agent-1', 'simple');

      expect(result.provider).toBe('OpenAI');
    });

    it('should fall back to pricing.provider when no model name has a prefix', async () => {
      mockTierService.getTiers.mockResolvedValue([
        { tier: 'simple', override_model: null, auto_assigned_model: 'custom-model' },
      ]);
      mockProviderKeyService.getEffectiveModel.mockResolvedValue('custom-model');
      // Neither model nor pricing.model_name have a slash
      mockPricingCache.getByModel.mockReturnValue({
        model_name: 'custom-model',
        provider: 'CustomProvider',
      });

      const result = await service.resolveForTier('agent-1', 'simple');

      expect(result.provider).toBe('CustomProvider');
    });
  });

  describe('resolveForTier auth_type', () => {
    it('should propagate override_auth_type in resolveForTier', async () => {
      mockTierService.getTiers.mockResolvedValue([
        {
          tier: 'simple',
          override_model: 'claude-sonnet-4',
          override_auth_type: 'subscription',
          auto_assigned_model: 'gpt-4o-mini',
        },
      ]);
      mockProviderKeyService.getEffectiveModel.mockResolvedValue('claude-sonnet-4');
      mockPricingCache.getByModel.mockReturnValue({ provider: 'Anthropic' });

      const result = await service.resolveForTier('agent-1', 'simple');

      expect(result.auth_type).toBe('subscription');
      expect(mockProviderKeyService.getAuthType).not.toHaveBeenCalled();
    });

    it('should fall back to getAuthType in resolveForTier when no override', async () => {
      mockTierService.getTiers.mockResolvedValue([
        {
          tier: 'simple',
          override_model: null,
          override_auth_type: null,
          auto_assigned_model: 'gpt-4o-mini',
        },
      ]);
      mockProviderKeyService.getEffectiveModel.mockResolvedValue('gpt-4o-mini');
      mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });
      mockProviderKeyService.getAuthType.mockResolvedValue('api_key');

      const result = await service.resolveForTier('agent-1', 'simple');

      expect(result.auth_type).toBe('api_key');
      expect(mockProviderKeyService.getAuthType).toHaveBeenCalledWith('agent-1', 'OpenAI');
    });

    it('should not include auth_type in resolveForTier when model is null', async () => {
      mockTierService.getTiers.mockResolvedValue([
        {
          tier: 'simple',
          override_model: null,
          override_auth_type: null,
          auto_assigned_model: null,
        },
      ]);
      mockProviderKeyService.getEffectiveModel.mockResolvedValue(null);

      const result = await service.resolveForTier('agent-1', 'simple');

      expect(result.auth_type).toBeUndefined();
      expect(mockProviderKeyService.getAuthType).not.toHaveBeenCalled();
    });
  });

  it('should pass tools to scorer for tier floor', async () => {
    mockProviderKeyService.getEffectiveModel.mockResolvedValue('gpt-4o');
    mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });

    const result = await service.resolve(
      'agent-1',
      [{ role: 'user', content: 'hi' }],
      [{ name: 'search' }],
      'auto',
    );

    // Tools force at least 'standard' tier
    expect(result.tier).not.toBe('simple');
  });
});
