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

    const result = await service.resolve(
      'user-1',
      [{ role: 'user', content: 'hello' }],
    );

    expect(result.tier).toBe('simple');
    expect(result.model).toBe('gpt-4o-mini');
    expect(result.provider).toBe('OpenAI');
    expect(result.reason).toBe('short_message');
  });

  it('should return null model when no effective model available', async () => {
    mockRoutingService.getEffectiveModel.mockResolvedValue(null);

    const result = await service.resolve(
      'user-1',
      [{ role: 'user', content: 'hello' }],
    );

    expect(result.tier).toBe('simple');
    expect(result.model).toBeNull();
    expect(result.provider).toBeNull();
  });

  it('should return null model when no tier assignment found', async () => {
    mockRoutingService.getTiers.mockResolvedValue([]);

    const result = await service.resolve(
      'user-1',
      [{ role: 'user', content: 'hello' }],
    );

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

    const result = await service.resolve('user-1', messages);

    expect(['complex', 'standard', 'reasoning']).toContain(result.tier);
    expect(result.model).toBe('claude-sonnet-4');
  });

  it('should pass momentum (recentTiers) to scorer', async () => {
    mockRoutingService.getEffectiveModel.mockResolvedValue('gpt-4o');
    mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });

    const result = await service.resolve(
      'user-1',
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

    const result = await service.resolve(
      'user-1',
      [{ role: 'user', content: 'hello' }],
    );

    expect(result.model).toBe('unknown-model');
    expect(result.provider).toBeNull();
  });

  describe('resolveForTier', () => {
    it('should return model for an assigned tier', async () => {
      mockRoutingService.getEffectiveModel.mockResolvedValue('gpt-4o-mini');
      mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });

      const result = await service.resolveForTier('user-1', 'simple');

      expect(result.tier).toBe('simple');
      expect(result.model).toBe('gpt-4o-mini');
      expect(result.provider).toBe('OpenAI');
      expect(result.confidence).toBe(1);
      expect(result.score).toBe(0);
      expect(result.reason).toBe('heartbeat');
    });

    it('should return null model when tier has no assignment', async () => {
      mockRoutingService.getTiers.mockResolvedValue([]);

      const result = await service.resolveForTier('user-1', 'simple');

      expect(result.tier).toBe('simple');
      expect(result.model).toBeNull();
      expect(result.provider).toBeNull();
      expect(result.reason).toBe('heartbeat');
    });

    it('should return null model when effective model is null', async () => {
      mockRoutingService.getEffectiveModel.mockResolvedValue(null);

      const result = await service.resolveForTier('user-1', 'simple');

      expect(result.tier).toBe('simple');
      expect(result.model).toBeNull();
      expect(result.provider).toBeNull();
    });
  });

  it('should pass tools to scorer for tier floor', async () => {
    mockRoutingService.getEffectiveModel.mockResolvedValue('gpt-4o');
    mockPricingCache.getByModel.mockReturnValue({ provider: 'OpenAI' });

    const result = await service.resolve(
      'user-1',
      [{ role: 'user', content: 'hi' }],
      [{ name: 'search' }],
      'auto',
    );

    // Tools force at least 'standard' tier
    expect(result.tier).not.toBe('simple');
  });
});
