import { ResolveService } from './resolve/resolve.service';
import { TierService } from './routing-core/tier.service';
import { ProviderKeyService } from './routing-core/provider-key.service';
import { SpecificityService } from './routing-core/specificity.service';
import { SpecificityPenaltyService } from './routing-core/specificity-penalty.service';
import { HeaderTierService } from './header-tiers/header-tier.service';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';
import { ModelDiscoveryService } from '../model-discovery/model-discovery.service';

describe('ResolveService', () => {
  let service: ResolveService;
  let mockTierService: Record<string, jest.Mock>;
  let mockProviderKeyService: Record<string, jest.Mock>;
  let mockSpecificityService: Record<string, jest.Mock>;
  let mockPricingCache: Record<string, jest.Mock>;
  let mockDiscoveryService: Record<string, jest.Mock>;
  let mockPenaltyService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockTierService = {
      getTiers: jest.fn().mockResolvedValue([
        { tier: 'simple', override_model: null, auto_assigned_model: 'gpt-4o-mini' },
        { tier: 'standard', override_model: null, auto_assigned_model: 'gpt-4o' },
        { tier: 'complex', override_model: null, auto_assigned_model: 'claude-sonnet-4' },
        { tier: 'reasoning', override_model: null, auto_assigned_model: 'claude-opus-4-6' },
        { tier: 'default', override_model: null, auto_assigned_model: 'gpt-4o' },
      ]),
    };
    mockProviderKeyService = {
      getEffectiveModel: jest.fn(),
      getAuthType: jest.fn().mockResolvedValue('api_key'),
      hasActiveProvider: jest.fn().mockResolvedValue(true),
      isModelAvailable: jest.fn().mockResolvedValue(true),
    };
    mockSpecificityService = {
      getActiveAssignments: jest.fn().mockResolvedValue([]),
    };
    mockPricingCache = {
      getByModel: jest.fn(),
    };
    mockDiscoveryService = {
      getModelForAgent: jest.fn().mockResolvedValue(undefined),
    };
    mockPenaltyService = {
      getPenaltiesForAgent: jest.fn().mockResolvedValue(new Map()),
    };

    service = new ResolveService(
      mockTierService as unknown as TierService,
      mockProviderKeyService as unknown as ProviderKeyService,
      mockSpecificityService as unknown as SpecificityService,
      mockPricingCache as unknown as ModelPricingCacheService,
      mockDiscoveryService as unknown as ModelDiscoveryService,
      mockPenaltyService as unknown as SpecificityPenaltyService,
      { list: jest.fn().mockResolvedValue([]) } as unknown as HeaderTierService,
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

  it('falls back to the default tier when no assignment matches the scored tier', async () => {
    // When the scored tier has no assignment, resolve() now hands the request
    // to the default tier as a catch-all instead of returning a null model.
    mockTierService.getTiers.mockResolvedValue([
      { tier: 'complex', override_model: null, auto_assigned_model: 'claude-sonnet-4' },
      { tier: 'default', override_model: null, auto_assigned_model: 'gpt-4o-mini' },
    ]);
    mockProviderKeyService.getEffectiveModel.mockResolvedValue('gpt-4o-mini');
    mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });

    const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

    expect(result.tier).toBe('default');
    expect(result.reason).toBe('default');
    expect(result.model).toBe('gpt-4o-mini');
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

  describe('provider prefix validation (#1383)', () => {
    it('should fall through to discovered models when inferred prefix provider is inactive', async () => {
      mockTierService.getTiers.mockResolvedValue([
        { tier: 'simple', override_model: null, auto_assigned_model: 'anthropic/claude-sonnet-4' },
      ]);
      mockProviderKeyService.getEffectiveModel.mockResolvedValue('anthropic/claude-sonnet-4');
      // Anthropic is disabled — hasActiveProvider returns false
      mockProviderKeyService.hasActiveProvider.mockResolvedValue(false);
      // Discovery correctly maps the model to OpenRouter
      mockDiscoveryService.getModelForAgent.mockResolvedValue({
        id: 'anthropic/claude-sonnet-4',
        provider: 'openrouter',
      });

      const result = await service.resolveForTier('agent-1', 'simple');

      expect(result.provider).toBe('openrouter');
      expect(mockProviderKeyService.hasActiveProvider).toHaveBeenCalledWith('agent-1', 'anthropic');
    });

    it('should use prefix when inferred provider is active', async () => {
      mockTierService.getTiers.mockResolvedValue([
        { tier: 'simple', override_model: null, auto_assigned_model: 'anthropic/claude-sonnet-4' },
      ]);
      mockProviderKeyService.getEffectiveModel.mockResolvedValue('anthropic/claude-sonnet-4');
      mockProviderKeyService.hasActiveProvider.mockResolvedValue(true);

      const result = await service.resolveForTier('agent-1', 'simple');

      expect(result.provider).toBe('anthropic');
      // Discovery should not be called — fast path used
      expect(mockDiscoveryService.getModelForAgent).not.toHaveBeenCalled();
    });
  });

  it('should pass tools to scorer for tier floor', async () => {
    mockProviderKeyService.getEffectiveModel.mockResolvedValue('gpt-4o');
    mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });

    // Message is long enough to bypass the short-message fast path so the
    // tools-floor branch in applyTierFloors is exercised.
    const result = await service.resolve(
      'agent-1',
      [
        {
          role: 'user',
          content: 'Please list the items you know about and summarise what they do.',
        },
      ],
      [{ name: 'search' }],
      'auto',
    );

    // Tools force at least 'standard' tier
    expect(result.tier).not.toBe('simple');
  });

  describe('resolveSpecificity', () => {
    it('should return specificity result when active assignment matches coding keywords', async () => {
      mockSpecificityService.getActiveAssignments.mockResolvedValue([
        {
          category: 'coding',
          override_model: 'claude-sonnet-4',
          override_provider: 'anthropic',
          override_auth_type: null,
          auto_assigned_model: null,
          fallback_models: ['gpt-4o', 'deepseek-chat'],
        },
      ]);
      mockProviderKeyService.hasActiveProvider.mockResolvedValue(true);

      const result = await service.resolve('agent-1', [
        { role: 'user', content: 'write a function to implement a sorting algorithm' },
      ]);

      expect(result.tier).toBe('standard');
      expect(result.model).toBe('claude-sonnet-4');
      expect(result.provider).toBe('anthropic');
      expect(result.reason).toBe('specificity');
      expect(result.specificity_category).toBe('coding');
      expect(result.fallback_models).toEqual(['gpt-4o', 'deepseek-chat']);
    });

    it('should return null when no active assignments exist', async () => {
      mockSpecificityService.getActiveAssignments.mockResolvedValue([]);
      mockProviderKeyService.getEffectiveModel.mockResolvedValue('gpt-4o-mini');
      mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });

      const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

      // Falls through to normal scoring (not specificity)
      expect(result.reason).not.toBe('specificity');
      expect(result.specificity_category).toBeUndefined();
    });

    it('should fall through when message has no specificity keywords', async () => {
      mockSpecificityService.getActiveAssignments.mockResolvedValue([
        {
          category: 'coding',
          override_model: 'gpt-4o',
          override_provider: 'openai',
          override_auth_type: null,
          auto_assigned_model: null,
          is_active: true,
        },
      ]);
      mockProviderKeyService.getEffectiveModel.mockResolvedValue('gpt-4o-mini');
      mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });

      // "hello" has no coding keywords — scanMessages returns null
      const result = await service.resolve('agent-1', [{ role: 'user', content: 'hello' }]);

      expect(result.reason).not.toBe('specificity');
      expect(result.specificity_category).toBeUndefined();
    });

    it('should return null when detected category has no matching assignment', async () => {
      mockSpecificityService.getActiveAssignments.mockResolvedValue([
        {
          category: 'web_browsing',
          override_model: 'gpt-4o',
          override_provider: 'openai',
          override_auth_type: null,
          auto_assigned_model: null,
        },
      ]);
      mockProviderKeyService.getEffectiveModel.mockResolvedValue('gpt-4o-mini');
      mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });

      // Send coding keywords but only web_browsing assignment is active
      const result = await service.resolve('agent-1', [
        { role: 'user', content: 'write a function to implement a sorting algorithm' },
      ]);

      // Falls through to normal scoring since no coding assignment
      expect(result.reason).not.toBe('specificity');
    });

    it('should return null when assignment has no model', async () => {
      mockSpecificityService.getActiveAssignments.mockResolvedValue([
        {
          category: 'coding',
          override_model: null,
          override_provider: null,
          override_auth_type: null,
          auto_assigned_model: null,
        },
      ]);
      mockProviderKeyService.getEffectiveModel.mockResolvedValue('gpt-4o-mini');
      mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });

      const result = await service.resolve('agent-1', [
        { role: 'user', content: 'write a function to implement a sorting algorithm' },
      ]);

      // Falls through to normal scoring since no model on assignment
      expect(result.reason).not.toBe('specificity');
    });

    it('should use auto_assigned_model when override_model is null', async () => {
      mockSpecificityService.getActiveAssignments.mockResolvedValue([
        {
          category: 'coding',
          override_model: null,
          override_provider: null,
          override_auth_type: null,
          auto_assigned_model: 'gpt-4o',
        },
      ]);
      mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });

      const result = await service.resolve('agent-1', [
        { role: 'user', content: 'write a function to implement a sorting algorithm' },
      ]);

      expect(result.model).toBe('gpt-4o');
      expect(result.reason).toBe('specificity');
      expect(result.specificity_category).toBe('coding');
    });

    it('should propagate override_auth_type from specificity assignment', async () => {
      mockSpecificityService.getActiveAssignments.mockResolvedValue([
        {
          category: 'coding',
          override_model: 'claude-sonnet-4',
          override_provider: 'anthropic',
          override_auth_type: 'subscription',
          auto_assigned_model: null,
        },
      ]);
      mockProviderKeyService.hasActiveProvider.mockResolvedValue(true);

      const result = await service.resolve('agent-1', [
        { role: 'user', content: 'write a function to implement a sorting algorithm' },
      ]);

      expect(result.auth_type).toBe('subscription');
      expect(mockProviderKeyService.getAuthType).not.toHaveBeenCalled();
    });

    it('should fall back to getAuthType when specificity assignment has no override_auth_type', async () => {
      mockSpecificityService.getActiveAssignments.mockResolvedValue([
        {
          category: 'coding',
          override_model: 'claude-sonnet-4',
          override_provider: 'anthropic',
          override_auth_type: null,
          auto_assigned_model: null,
        },
      ]);
      mockProviderKeyService.hasActiveProvider.mockResolvedValue(true);
      mockProviderKeyService.getAuthType.mockResolvedValue('api_key');

      const result = await service.resolve('agent-1', [
        { role: 'user', content: 'write a function to implement a sorting algorithm' },
      ]);

      expect(result.auth_type).toBe('api_key');
      expect(mockProviderKeyService.getAuthType).toHaveBeenCalledWith('agent-1', 'anthropic');
    });

    it('should accept specificity override via header', async () => {
      mockSpecificityService.getActiveAssignments.mockResolvedValue([
        {
          category: 'coding',
          override_model: 'claude-sonnet-4',
          override_provider: 'anthropic',
          override_auth_type: null,
          auto_assigned_model: null,
        },
      ]);
      mockProviderKeyService.hasActiveProvider.mockResolvedValue(true);

      // Short message that would NOT trigger coding detection, but header forces it
      const result = await service.resolve(
        'agent-1',
        [{ role: 'user', content: 'hello' }],
        undefined,
        undefined,
        undefined,
        undefined,
        'coding',
      );

      expect(result.reason).toBe('specificity');
      expect(result.specificity_category).toBe('coding');
    });

    it('should return undefined auth_type when provider is null', async () => {
      mockSpecificityService.getActiveAssignments.mockResolvedValue([
        {
          category: 'coding',
          override_model: null,
          override_provider: null,
          override_auth_type: null,
          auto_assigned_model: 'unknown-model',
        },
      ]);
      mockPricingCache.getByModel.mockReturnValue(undefined);
      mockProviderKeyService.hasActiveProvider.mockResolvedValue(false);
      mockDiscoveryService.getModelForAgent.mockResolvedValue(undefined);

      const result = await service.resolve('agent-1', [
        { role: 'user', content: 'write a function to implement a sorting algorithm' },
      ]);

      expect(result.reason).toBe('specificity');
      expect(result.provider).toBeNull();
      expect(result.auth_type).toBeUndefined();
    });
  });
});
