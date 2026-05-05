import type { Repository } from 'typeorm';
import type { ModelRoute } from 'manifest-shared';
import { ResolveService } from '../resolve.service';
import { Agent } from '../../../entities/agent.entity';
import type { TierAssignment } from '../../../entities/tier-assignment.entity';
import type { SpecificityAssignment } from '../../../entities/specificity-assignment.entity';
import type { HeaderTier } from '../../../entities/header-tier.entity';
import type { TierService } from '../../routing-core/tier.service';
import type { ProviderKeyService } from '../../routing-core/provider-key.service';
import type { SpecificityService } from '../../routing-core/specificity.service';
import type { SpecificityPenaltyService } from '../../routing-core/specificity-penalty.service';
import type { HeaderTierService } from '../../header-tiers/header-tier.service';
import type { ModelPricingCacheService } from '../../../model-prices/model-pricing-cache.service';
import type { ModelDiscoveryService } from '../../../model-discovery/model-discovery.service';

/**
 * Mock the scoring module so each test can drive scoreRequest / scanMessages
 * deterministically. Defaulting to a low confidence that fails the 0.4 gate
 * keeps "specificity falls through" the default unless a test opts in.
 */
jest.mock('../../../scoring', () => ({
  scoreRequest: jest.fn(),
  scanMessages: jest.fn(),
}));

jest.mock('../../../common/utils/provider-aliases', () => {
  const actual = jest.requireActual('../../../common/utils/provider-aliases');
  return { ...actual, inferProviderFromModelName: jest.fn(actual.inferProviderFromModelName) };
});

import { scoreRequest, scanMessages } from '../../../scoring';
import { inferProviderFromModelName } from '../../../common/utils/provider-aliases';

const mockedScore = scoreRequest as jest.MockedFunction<typeof scoreRequest>;
const mockedScan = scanMessages as jest.MockedFunction<typeof scanMessages>;
const mockedInferProvider = inferProviderFromModelName as jest.MockedFunction<
  typeof inferProviderFromModelName
>;

const route = (provider: string, authType: ModelRoute['authType'], model: string): ModelRoute => ({
  provider,
  authType,
  model,
});

describe('ResolveService', () => {
  let tierService: jest.Mocked<Pick<TierService, 'getTiers'>>;
  let providerKeyService: jest.Mocked<
    Pick<ProviderKeyService, 'isModelAvailable' | 'hasActiveProvider' | 'getAuthType'>
  >;
  let specificityService: jest.Mocked<Pick<SpecificityService, 'getActiveAssignments'>>;
  let pricingCache: jest.Mocked<Pick<ModelPricingCacheService, 'getByModel'>>;
  let discoveryService: jest.Mocked<
    Pick<ModelDiscoveryService, 'getModelForAgent' | 'getModelsForAgent'>
  >;
  let penaltyService: jest.Mocked<Pick<SpecificityPenaltyService, 'getPenaltiesForAgent'>>;
  let headerTierService: jest.Mocked<Pick<HeaderTierService, 'list'>>;
  let agentRepo: { findOne: jest.Mock };
  let svc: ResolveService;

  beforeEach(() => {
    jest.clearAllMocks();
    tierService = { getTiers: jest.fn().mockResolvedValue([]) };
    providerKeyService = {
      isModelAvailable: jest.fn().mockResolvedValue(true),
      hasActiveProvider: jest.fn().mockResolvedValue(true),
      getAuthType: jest.fn().mockResolvedValue('api_key'),
    };
    specificityService = { getActiveAssignments: jest.fn().mockResolvedValue([]) };
    pricingCache = { getByModel: jest.fn().mockReturnValue(undefined) };
    discoveryService = {
      getModelForAgent: jest.fn().mockResolvedValue(null),
      getModelsForAgent: jest.fn().mockResolvedValue([]),
    };
    penaltyService = { getPenaltiesForAgent: jest.fn().mockResolvedValue(new Map()) };
    headerTierService = { list: jest.fn().mockResolvedValue([]) };
    agentRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'agent-1', complexity_routing_enabled: true }),
    };

    // Defaults — each test overrides as needed.
    mockedScore.mockReturnValue({
      tier: 'standard',
      confidence: 0.9,
      score: 5,
      reason: 'scored',
    } as unknown as ReturnType<typeof scoreRequest>);
    mockedScan.mockReturnValue(null);
    mockedInferProvider.mockReturnValue(undefined);

    svc = new ResolveService(
      tierService as unknown as TierService,
      providerKeyService as unknown as ProviderKeyService,
      specificityService as unknown as SpecificityService,
      pricingCache as unknown as ModelPricingCacheService,
      discoveryService as unknown as ModelDiscoveryService,
      penaltyService as unknown as SpecificityPenaltyService,
      headerTierService as unknown as HeaderTierService,
      agentRepo as unknown as Repository<Agent>,
    );
  });

  const messages = [{ role: 'user' as const, content: 'hello' }];

  describe('resolve — header tier match', () => {
    it('returns the header-tier route when the rule matches', async () => {
      const tier = {
        id: 'h1',
        name: 'Premium',
        header_key: 'x-tier',
        header_value: 'gold',
        enabled: true,
        badge_color: 'red',
        override_route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: null,
      } as unknown as HeaderTier;
      headerTierService.list.mockResolvedValue([tier]);

      const result = await svc.resolve(
        'agent-1',
        messages,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          'x-tier': 'gold',
        },
      );

      expect(result.reason).toBe('header-match');
      expect(result.route).toEqual(route('openai', 'api_key', 'gpt-4o'));
      expect(result.header_tier_id).toBe('h1');
      expect(result.header_tier_name).toBe('Premium');
      expect(result.header_tier_color).toBe('red');
    });

    it('returns null when no header tiers exist', async () => {
      headerTierService.list.mockResolvedValue([]);
      const result = await svc.resolve(
        'agent-1',
        messages,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { 'x-tier': 'gold' },
      );
      // Falls through to scored tier — reason should be 'scored', not 'header-match'.
      expect(result.reason).not.toBe('header-match');
    });

    it('falls through when the matched tier has no override route', async () => {
      const tier = {
        id: 'h1',
        name: 'Premium',
        header_key: 'x-tier',
        header_value: 'gold',
        enabled: true,
        badge_color: 'red',
        override_route: null,
        fallback_routes: null,
      } as unknown as HeaderTier;
      headerTierService.list.mockResolvedValue([tier]);

      const result = await svc.resolve(
        'agent-1',
        messages,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { 'x-tier': 'gold' },
      );
      expect(result.reason).not.toBe('header-match');
    });

    it('falls through when the override model is not available', async () => {
      const tier = {
        id: 'h1',
        name: 'Premium',
        header_key: 'x-tier',
        header_value: 'gold',
        enabled: true,
        badge_color: 'red',
        override_route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: null,
      } as unknown as HeaderTier;
      headerTierService.list.mockResolvedValue([tier]);
      providerKeyService.isModelAvailable.mockResolvedValue(false);

      const result = await svc.resolve(
        'agent-1',
        messages,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { 'x-tier': 'gold' },
      );
      expect(result.reason).not.toBe('header-match');
    });

    it('matches when the header value is provided as an array', async () => {
      const tier = {
        id: 'h1',
        name: 'Premium',
        header_key: 'x-tier',
        header_value: 'gold',
        enabled: true,
        badge_color: 'red',
        override_route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: null,
      } as unknown as HeaderTier;
      headerTierService.list.mockResolvedValue([tier]);

      const result = await svc.resolve(
        'agent-1',
        messages,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { 'x-tier': ['silver', 'gold'] },
      );
      expect(result.reason).toBe('header-match');
    });

    it('skips disabled header tiers', async () => {
      const tier = {
        id: 'h1',
        name: 'Premium',
        header_key: 'x-tier',
        header_value: 'gold',
        enabled: false,
        badge_color: 'red',
        override_route: route('openai', 'api_key', 'gpt-4o'),
        fallback_routes: null,
      } as unknown as HeaderTier;
      headerTierService.list.mockResolvedValue([tier]);

      const result = await svc.resolve(
        'agent-1',
        messages,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { 'x-tier': 'gold' },
      );
      expect(result.reason).not.toBe('header-match');
    });

    it('returns null route when no provider can be resolved for the override model', async () => {
      const tier = {
        id: 'h1',
        name: 'Premium',
        header_key: 'x-tier',
        header_value: 'gold',
        enabled: true,
        badge_color: 'red',
        // Empty provider triggers the resolveProviderForModel fallback chain.
        // authType '' is also falsy, so getAuthType is consulted.
        override_route: {
          provider: '',
          authType: '',
          model: 'mystery-model',
        } as unknown as ModelRoute,
        fallback_routes: null,
      } as unknown as HeaderTier;
      headerTierService.list.mockResolvedValue([tier]);

      // None of the resolveProviderForModel paths produce a hit.
      mockedInferProvider.mockReturnValue(undefined);
      discoveryService.getModelForAgent.mockResolvedValue(undefined);
      pricingCache.getByModel.mockReturnValue(undefined);
      // No provider resolved → route is null even though authType defaults exist.
      providerKeyService.getAuthType.mockResolvedValue('api_key');

      const result = await svc.resolve(
        'agent-1',
        messages,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { 'x-tier': 'gold' },
      );
      expect(result.reason).toBe('header-match');
      expect(result.route).toBeNull();
    });
  });

  describe('resolveProviderForModel paths (via header tier with bare model)', () => {
    // Provider field is empty (falsy) so resolveProviderForModel runs via the
    // `||` short-circuit. authType is a real value so the route can be built
    // when a provider is found.
    const bareTier = {
      id: 'h1',
      name: 'P',
      header_key: 'x-tier',
      header_value: 'gold',
      enabled: true,
      badge_color: 'red',
      override_route: {
        model: 'gpt-4o',
        provider: '',
        authType: 'api_key',
      } as unknown as ModelRoute,
      fallback_routes: null,
    } as unknown as HeaderTier;

    it('uses prefix inference when an active provider matches', async () => {
      headerTierService.list.mockResolvedValue([bareTier]);
      mockedInferProvider.mockReturnValue('openai');
      providerKeyService.hasActiveProvider.mockResolvedValue(true);

      const result = await svc.resolve(
        'agent-1',
        messages,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { 'x-tier': 'gold' },
      );
      expect(result.reason).toBe('header-match');
      expect(result.route?.provider).toBe('openai');
    });

    it('uses discovery when prefix inference is null', async () => {
      headerTierService.list.mockResolvedValue([bareTier]);
      mockedInferProvider.mockReturnValue(undefined);
      discoveryService.getModelForAgent.mockResolvedValue({
        id: 'gpt-4o',
        provider: 'openai',
        authType: 'api_key',
      } as never);

      const result = await svc.resolve(
        'agent-1',
        messages,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { 'x-tier': 'gold' },
      );
      expect(result.route?.provider).toBe('openai');
    });

    it('uses pricing cache when discovery has no entry', async () => {
      headerTierService.list.mockResolvedValue([bareTier]);
      mockedInferProvider.mockReturnValue(undefined);
      discoveryService.getModelForAgent.mockResolvedValue(undefined);
      pricingCache.getByModel.mockReturnValue({
        provider: 'OpenAI',
        model_name: 'gpt-4o',
        display_name: null,
        input_price_per_token: 0,
        output_price_per_token: 0,
      } as never);

      const result = await svc.resolve(
        'agent-1',
        messages,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { 'x-tier': 'gold' },
      );
      expect(result.route?.provider).toBe('OpenAI');
    });

    it('skips OpenRouter aggregator entries', async () => {
      headerTierService.list.mockResolvedValue([bareTier]);
      mockedInferProvider.mockReturnValue(undefined);
      discoveryService.getModelForAgent.mockResolvedValue(undefined);
      pricingCache.getByModel.mockReturnValue({
        provider: 'OpenRouter',
        model_name: 'gpt-4o',
        display_name: null,
        input_price_per_token: 0,
        output_price_per_token: 0,
      } as never);
      const result = await svc.resolve(
        'agent-1',
        messages,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { 'x-tier': 'gold' },
      );
      expect(result.route).toBeNull();
    });
  });

  describe('resolve — complexity routing disabled', () => {
    it('returns the default tier route', async () => {
      agentRepo.findOne.mockResolvedValue({ id: 'agent-1', complexity_routing_enabled: false });
      tierService.getTiers.mockResolvedValue([
        {
          tier: 'default',
          override_route: null,
          auto_assigned_route: route('openai', 'api_key', 'gpt-4o-mini'),
          fallback_routes: null,
        } as TierAssignment,
      ]);

      const result = await svc.resolve('agent-1', messages);
      expect(result.tier).toBe('default');
      expect(result.reason).toBe('default');
      expect(result.route).toEqual(route('openai', 'api_key', 'gpt-4o-mini'));
    });
  });

  describe('resolve — specificity routing', () => {
    it('returns the specificity override when above the confidence gate', async () => {
      specificityService.getActiveAssignments.mockResolvedValue([
        {
          category: 'coding',
          is_active: true,
          override_route: route('openai', 'api_key', 'gpt-4o'),
          auto_assigned_route: null,
          fallback_routes: [route('anthropic', 'api_key', 'claude')],
        } as unknown as SpecificityAssignment,
      ]);
      mockedScan.mockReturnValue({ category: 'coding', confidence: 0.9 } as never);

      const result = await svc.resolve('agent-1', messages);
      expect(result.reason).toBe('specificity');
      expect(result.specificity_category).toBe('coding');
      expect(result.route).toEqual(route('openai', 'api_key', 'gpt-4o'));
      expect(result.fallback_routes).toEqual([route('anthropic', 'api_key', 'claude')]);
    });

    it('falls through when the override model is unavailable', async () => {
      specificityService.getActiveAssignments.mockResolvedValue([
        {
          category: 'coding',
          is_active: true,
          override_route: route('openai', 'api_key', 'orphaned'),
          auto_assigned_route: null,
          fallback_routes: null,
        } as unknown as SpecificityAssignment,
      ]);
      mockedScan.mockReturnValue({ category: 'coding', confidence: 0.9 } as never);
      providerKeyService.isModelAvailable.mockResolvedValue(false);
      tierService.getTiers.mockResolvedValue([
        {
          tier: 'standard',
          override_route: null,
          auto_assigned_route: route('openai', 'api_key', 'gpt-4o'),
          fallback_routes: null,
        } as TierAssignment,
      ]);

      const result = await svc.resolve('agent-1', messages);
      expect(result.reason).toBe('scored');
    });

    it('uses auto_assigned_route when there is no override', async () => {
      specificityService.getActiveAssignments.mockResolvedValue([
        {
          category: 'coding',
          is_active: true,
          override_route: null,
          auto_assigned_route: route('openai', 'api_key', 'gpt-4o'),
          fallback_routes: null,
        } as unknown as SpecificityAssignment,
      ]);
      mockedScan.mockReturnValue({ category: 'coding', confidence: 0.9 } as never);

      const result = await svc.resolve('agent-1', messages);
      expect(result.reason).toBe('specificity');
      expect(result.route).toEqual(route('openai', 'api_key', 'gpt-4o'));
    });

    it('returns null when neither override nor auto are set', async () => {
      specificityService.getActiveAssignments.mockResolvedValue([
        {
          category: 'coding',
          is_active: true,
          override_route: null,
          auto_assigned_route: null,
          fallback_routes: null,
        } as unknown as SpecificityAssignment,
      ]);
      mockedScan.mockReturnValue({ category: 'coding', confidence: 0.9 } as never);
      tierService.getTiers.mockResolvedValue([
        {
          tier: 'standard',
          override_route: null,
          auto_assigned_route: route('openai', 'api_key', 'gpt-4o'),
          fallback_routes: null,
        } as TierAssignment,
      ]);

      const result = await svc.resolve('agent-1', messages);
      // Specificity returned null — falls through to scored.
      expect(result.reason).toBe('scored');
    });

    it('skips specificity when no assignments are active', async () => {
      specificityService.getActiveAssignments.mockResolvedValue([]);
      tierService.getTiers.mockResolvedValue([
        {
          tier: 'standard',
          override_route: null,
          auto_assigned_route: route('openai', 'api_key', 'gpt-4o'),
          fallback_routes: null,
        } as TierAssignment,
      ]);
      const result = await svc.resolve('agent-1', messages);
      expect(result.reason).toBe('scored');
      expect(mockedScan).not.toHaveBeenCalled();
    });

    it('skips specificity when scan returns null', async () => {
      specificityService.getActiveAssignments.mockResolvedValue([
        { category: 'coding', is_active: true } as SpecificityAssignment,
      ]);
      mockedScan.mockReturnValue(null);
      tierService.getTiers.mockResolvedValue([
        {
          tier: 'standard',
          override_route: null,
          auto_assigned_route: route('openai', 'api_key', 'gpt-4o'),
          fallback_routes: null,
        } as TierAssignment,
      ]);
      const result = await svc.resolve('agent-1', messages);
      expect(result.reason).toBe('scored');
    });

    it('falls through when confidence is below the gate (no header override)', async () => {
      specificityService.getActiveAssignments.mockResolvedValue([
        {
          category: 'coding',
          is_active: true,
          override_route: route('openai', 'api_key', 'gpt-4o'),
          auto_assigned_route: null,
          fallback_routes: null,
        } as unknown as SpecificityAssignment,
      ]);
      mockedScan.mockReturnValue({ category: 'coding', confidence: 0.3 } as never);
      tierService.getTiers.mockResolvedValue([
        {
          tier: 'standard',
          override_route: null,
          auto_assigned_route: route('openai', 'api_key', 'fallback'),
          fallback_routes: null,
        } as TierAssignment,
      ]);

      const result = await svc.resolve('agent-1', messages);
      expect(result.reason).toBe('scored');
    });

    it('honors a header override even when confidence is below the gate', async () => {
      specificityService.getActiveAssignments.mockResolvedValue([
        {
          category: 'coding',
          is_active: true,
          override_route: route('openai', 'api_key', 'gpt-4o'),
          auto_assigned_route: null,
          fallback_routes: null,
        } as unknown as SpecificityAssignment,
      ]);
      mockedScan.mockReturnValue({ category: 'coding', confidence: 0.1 } as never);

      const result = await svc.resolve(
        'agent-1',
        messages,
        undefined,
        undefined,
        undefined,
        undefined,
        'coding',
      );
      expect(result.reason).toBe('specificity');
    });

    it('passes penalty map into scanMessages when penalties exist', async () => {
      specificityService.getActiveAssignments.mockResolvedValue([
        { category: 'coding', is_active: true } as SpecificityAssignment,
      ]);
      const penalties = new Map<'coding', number>([['coding', 1]]);
      penaltyService.getPenaltiesForAgent.mockResolvedValue(penalties as never);
      mockedScan.mockReturnValue(null);

      await svc.resolve('agent-1', messages);
      expect(mockedScan).toHaveBeenCalled();
      const call = mockedScan.mock.calls[0];
      expect(call[4]).toBe(penalties);
    });

    it('returns null when the matched category has no active assignment', async () => {
      specificityService.getActiveAssignments.mockResolvedValue([
        { category: 'web_browsing', is_active: true } as SpecificityAssignment,
      ]);
      mockedScan.mockReturnValue({ category: 'coding', confidence: 0.9 } as never);
      tierService.getTiers.mockResolvedValue([
        {
          tier: 'standard',
          override_route: null,
          auto_assigned_route: route('openai', 'api_key', 'gpt-4o'),
          fallback_routes: null,
        } as TierAssignment,
      ]);
      const result = await svc.resolve('agent-1', messages);
      expect(result.reason).toBe('scored');
    });
  });

  describe('resolve — scored complexity tiers', () => {
    it('returns the matched tier route', async () => {
      mockedScore.mockReturnValue({
        tier: 'complex',
        confidence: 0.8,
        score: 12,
        reason: 'scored',
      } as never);
      tierService.getTiers.mockResolvedValue([
        {
          tier: 'complex',
          override_route: route('anthropic', 'api_key', 'claude-opus'),
          auto_assigned_route: null,
          fallback_routes: [route('openai', 'api_key', 'gpt-4o')],
        } as unknown as TierAssignment,
      ]);

      const result = await svc.resolve('agent-1', messages);
      expect(result.tier).toBe('complex');
      expect(result.route).toEqual(route('anthropic', 'api_key', 'claude-opus'));
      expect(result.fallback_routes).toEqual([route('openai', 'api_key', 'gpt-4o')]);
    });

    it('falls back to the default tier when the scored tier is missing', async () => {
      mockedScore.mockReturnValue({
        tier: 'reasoning',
        confidence: 0.95,
        score: 30,
        reason: 'scored',
      } as never);
      tierService.getTiers.mockResolvedValue([
        {
          tier: 'default',
          override_route: null,
          auto_assigned_route: route('openai', 'api_key', 'default-model'),
          fallback_routes: null,
        } as TierAssignment,
      ]);

      const result = await svc.resolve('agent-1', messages);
      expect(result.tier).toBe('default');
      expect(result.reason).toBe('default');
    });

    it('returns null route when the override is orphaned and auto is null', async () => {
      mockedScore.mockReturnValue({
        tier: 'standard',
        confidence: 0.7,
        score: 5,
        reason: 'scored',
      } as never);
      tierService.getTiers.mockResolvedValue([
        {
          tier: 'standard',
          override_route: route('openai', 'api_key', 'orphaned'),
          auto_assigned_route: null,
          fallback_routes: [route('anthropic', 'api_key', 'fallback-1')],
        } as unknown as TierAssignment,
      ]);
      providerKeyService.isModelAvailable.mockResolvedValue(false);

      const result = await svc.resolve('agent-1', messages);
      expect(result.tier).toBe('standard');
      expect(result.route).toBeNull();
      expect(result.fallback_routes).toEqual([route('anthropic', 'api_key', 'fallback-1')]);
    });

    it('falls through to auto when override is orphaned but auto is set', async () => {
      mockedScore.mockReturnValue({
        tier: 'standard',
        confidence: 0.7,
        score: 5,
        reason: 'scored',
      } as never);
      tierService.getTiers.mockResolvedValue([
        {
          tier: 'standard',
          override_route: route('openai', 'api_key', 'orphaned'),
          auto_assigned_route: route('openai', 'api_key', 'auto'),
          fallback_routes: null,
        } as unknown as TierAssignment,
      ]);
      providerKeyService.isModelAvailable.mockResolvedValue(false);

      const result = await svc.resolve('agent-1', messages);
      expect(result.route).toEqual(route('openai', 'api_key', 'auto'));
    });

    it('passes momentum input when recentTiers is non-empty', async () => {
      mockedScore.mockReturnValue({
        tier: 'standard',
        confidence: 0.7,
        score: 5,
        reason: 'scored',
      } as never);
      tierService.getTiers.mockResolvedValue([
        {
          tier: 'standard',
          override_route: null,
          auto_assigned_route: route('openai', 'api_key', 'gpt-4o'),
          fallback_routes: null,
        } as TierAssignment,
      ]);
      await svc.resolve('agent-1', messages, undefined, undefined, undefined, ['simple']);
      const [, , momentum] = mockedScore.mock.calls[0];
      expect(momentum).toEqual({ recentTiers: ['simple'] });
    });

    it('passes undefined momentum when recentTiers is empty', async () => {
      tierService.getTiers.mockResolvedValue([
        {
          tier: 'standard',
          override_route: null,
          auto_assigned_route: route('openai', 'api_key', 'gpt-4o'),
          fallback_routes: null,
        } as TierAssignment,
      ]);
      await svc.resolve('agent-1', messages, undefined, undefined, undefined, []);
      const [, , momentum] = mockedScore.mock.calls[0];
      expect(momentum).toBeUndefined();
    });
  });

  describe('resolveForTier', () => {
    it('returns null route when tier assignment is missing', async () => {
      tierService.getTiers.mockResolvedValue([]);
      const result = await svc.resolveForTier('agent-1', 'simple', 'heartbeat');
      expect(result.tier).toBe('simple');
      expect(result.route).toBeNull();
      expect(result.fallback_routes).toBeNull();
      expect(result.confidence).toBe(1);
      expect(result.reason).toBe('heartbeat');
    });

    it('returns the assigned route when present', async () => {
      tierService.getTiers.mockResolvedValue([
        {
          tier: 'simple',
          override_route: null,
          auto_assigned_route: route('openai', 'api_key', 'gpt-4o-mini'),
          fallback_routes: [route('anthropic', 'api_key', 'haiku')],
        } as unknown as TierAssignment,
      ]);
      const result = await svc.resolveForTier('agent-1', 'simple');
      expect(result.route).toEqual(route('openai', 'api_key', 'gpt-4o-mini'));
      expect(result.fallback_routes).toEqual([route('anthropic', 'api_key', 'haiku')]);
      expect(result.reason).toBe('heartbeat');
    });

    it('uses the default reason when the caller passes "default"', async () => {
      tierService.getTiers.mockResolvedValue([
        {
          tier: 'default',
          override_route: null,
          auto_assigned_route: route('openai', 'api_key', 'gpt-4o-mini'),
          fallback_routes: null,
        } as TierAssignment,
      ]);
      const result = await svc.resolveForTier('agent-1', 'default', 'default');
      expect(result.reason).toBe('default');
    });
  });
});
