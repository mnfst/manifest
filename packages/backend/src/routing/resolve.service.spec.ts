import { ResolveService } from './resolve.service';
import { RoutingService } from './routing.service';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';

describe('ResolveService', () => {
  let service: ResolveService;
  let mockRoutingService: Record<string, jest.Mock>;
  let mockPricingCache: Record<string, jest.Mock>;

  beforeEach(() => {
    mockRoutingService = {
      getTiers: jest.fn().mockResolvedValue([
        { tier: 'simple', override_model: null, auto_assigned_model: 'gpt-4o-mini' },
        { tier: 'standard', override_model: null, auto_assigned_model: 'gpt-4o' },
        { tier: 'complex', override_model: null, auto_assigned_model: 'claude-sonnet-4' },
        { tier: 'reasoning', override_model: null, auto_assigned_model: 'claude-opus-4-6' },
      ]),
      getEffectiveModel: jest.fn(),
      getAuthType: jest.fn().mockResolvedValue('api_key'),
    };
    mockPricingCache = {
      getByModel: jest.fn(),
    };

    service = new ResolveService(
      mockRoutingService as unknown as RoutingService,
      mockPricingCache as unknown as ModelPricingCacheService,
    );
  });

  it('should return simple tier for short message', async () => {
    mockRoutingService.getEffectiveModel.mockResolvedValue('gpt-4o-mini');
    mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });

    const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

    expect(result.tier).toBe('simple');
    expect(result.model).toBe('gpt-4o-mini');
    expect(result.provider).toBe('OpenAI');
    expect(result.auth_type).toBe('api_key');
    expect(result.reason).toBe('short_message');
  });

  it('should return null model when no effective model available', async () => {
    mockRoutingService.getEffectiveModel.mockResolvedValue(null);

    const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

    expect(result.tier).toBe('simple');
    expect(result.model).toBeNull();
    expect(result.provider).toBeNull();
  });

  it('should return null model when no tier assignment found', async () => {
    mockRoutingService.getTiers.mockResolvedValue([]);

    const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

    expect(result.model).toBeNull();
    expect(result.provider).toBeNull();
  });

  it('should resolve complex tier for elaborate messages', async () => {
    mockRoutingService.getEffectiveModel.mockResolvedValue('claude-sonnet-4');
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
    mockRoutingService.getEffectiveModel.mockResolvedValue('gpt-4o');
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
    mockRoutingService.getEffectiveModel.mockResolvedValue('unknown-model');
    mockPricingCache.getByModel.mockReturnValue(undefined);

    const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

    expect(result.model).toBe('unknown-model');
    expect(result.provider).toBeNull();
  });

  describe('resolveForTier', () => {
    it('should return model for an assigned tier', async () => {
      mockRoutingService.getEffectiveModel.mockResolvedValue('gpt-4o-mini');
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
      mockRoutingService.getTiers.mockResolvedValue([]);

      const result = await service.resolveForTier('agent-1', 'simple');

      expect(result.tier).toBe('simple');
      expect(result.model).toBeNull();
      expect(result.provider).toBeNull();
      expect(result.reason).toBe('heartbeat');
    });

    it('should return null model when effective model is null', async () => {
      mockRoutingService.getEffectiveModel.mockResolvedValue(null);

      const result = await service.resolveForTier('agent-1', 'simple');

      expect(result.tier).toBe('simple');
      expect(result.model).toBeNull();
      expect(result.provider).toBeNull();
    });
  });

  it('should log available tiers when no assignment matches scored tier', async () => {
    // Set up tiers that do NOT include the scored tier (simple).
    // scoreRequest returns 'simple' for short messages but we only provide 'complex'.
    mockRoutingService.getTiers.mockResolvedValue([
      { tier: 'complex', override_model: null, auto_assigned_model: 'claude-sonnet-4' },
    ]);

    const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

    expect(result.model).toBeNull();
    expect(result.provider).toBeNull();
    expect(result.tier).toBe('simple');
  });

  describe('auth_type resolution', () => {
    it('should propagate override_auth_type from tier assignment', async () => {
      mockRoutingService.getTiers.mockResolvedValue([
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
      mockRoutingService.getEffectiveModel.mockResolvedValue('claude-sonnet-4');
      mockPricingCache.getByModel.mockReturnValue({ provider: 'Anthropic' });

      const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

      expect(result.auth_type).toBe('subscription');
      // getAuthType should NOT be called when override_auth_type is set
      expect(mockRoutingService.getAuthType).not.toHaveBeenCalled();
    });

    it('should fall back to getAuthType when no override_auth_type', async () => {
      mockRoutingService.getTiers.mockResolvedValue([
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
      mockRoutingService.getEffectiveModel.mockResolvedValue('gpt-4o-mini');
      mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });
      mockRoutingService.getAuthType.mockResolvedValue('api_key');

      const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

      expect(result.auth_type).toBe('api_key');
      expect(mockRoutingService.getAuthType).toHaveBeenCalledWith('agent-1', 'OpenAI');
    });

    it('should return subscription from getAuthType when provider has subscription', async () => {
      mockRoutingService.getEffectiveModel.mockResolvedValue('claude-sonnet-4');
      mockPricingCache.getByModel.mockReturnValue({ provider: 'Anthropic' });
      mockRoutingService.getAuthType.mockResolvedValue('subscription');

      const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

      expect(result.auth_type).toBe('subscription');
    });

    it('should not include auth_type when provider is null', async () => {
      mockRoutingService.getEffectiveModel.mockResolvedValue(null);

      const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

      expect(result.auth_type).toBeUndefined();
      expect(mockRoutingService.getAuthType).not.toHaveBeenCalled();
    });
  });

  describe('resolveForTier provider inference fallback', () => {
    it('should use pricing.provider when model has no prefix', async () => {
      mockRoutingService.getTiers.mockResolvedValue([
        { tier: 'simple', override_model: null, auto_assigned_model: 'gpt-4o-mini' },
      ]);
      mockRoutingService.getEffectiveModel.mockResolvedValue('gpt-4o-mini');
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
      mockRoutingService.getTiers.mockResolvedValue([
        { tier: 'simple', override_model: null, auto_assigned_model: 'custom-model' },
      ]);
      mockRoutingService.getEffectiveModel.mockResolvedValue('custom-model');
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
      mockRoutingService.getTiers.mockResolvedValue([
        {
          tier: 'simple',
          override_model: 'claude-sonnet-4',
          override_auth_type: 'subscription',
          auto_assigned_model: 'gpt-4o-mini',
        },
      ]);
      mockRoutingService.getEffectiveModel.mockResolvedValue('claude-sonnet-4');
      mockPricingCache.getByModel.mockReturnValue({ provider: 'Anthropic' });

      const result = await service.resolveForTier('agent-1', 'simple');

      expect(result.auth_type).toBe('subscription');
      expect(mockRoutingService.getAuthType).not.toHaveBeenCalled();
    });

    it('should fall back to getAuthType in resolveForTier when no override', async () => {
      mockRoutingService.getTiers.mockResolvedValue([
        {
          tier: 'simple',
          override_model: null,
          override_auth_type: null,
          auto_assigned_model: 'gpt-4o-mini',
        },
      ]);
      mockRoutingService.getEffectiveModel.mockResolvedValue('gpt-4o-mini');
      mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });
      mockRoutingService.getAuthType.mockResolvedValue('api_key');

      const result = await service.resolveForTier('agent-1', 'simple');

      expect(result.auth_type).toBe('api_key');
      expect(mockRoutingService.getAuthType).toHaveBeenCalledWith('agent-1', 'OpenAI');
    });

    it('should not include auth_type in resolveForTier when model is null', async () => {
      mockRoutingService.getTiers.mockResolvedValue([
        {
          tier: 'simple',
          override_model: null,
          override_auth_type: null,
          auto_assigned_model: null,
        },
      ]);
      mockRoutingService.getEffectiveModel.mockResolvedValue(null);

      const result = await service.resolveForTier('agent-1', 'simple');

      expect(result.auth_type).toBeUndefined();
      expect(mockRoutingService.getAuthType).not.toHaveBeenCalled();
    });
  });

  it('should pass tools to scorer for tier floor', async () => {
    mockRoutingService.getEffectiveModel.mockResolvedValue('gpt-4o');
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
