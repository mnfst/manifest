jest.mock('../../scoring', () => {
  const scoreRequest = jest.fn();
  const scanMessages = jest.fn();
  return { scoreRequest, scanMessages };
});

import { ResolveService } from './resolve.service';
import { TierService } from '../routing-core/tier.service';
import { ProviderKeyService } from '../routing-core/provider-key.service';
import { SpecificityService } from '../routing-core/specificity.service';
import { SpecificityPenaltyService } from '../routing-core/specificity-penalty.service';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const scoring = require('../../scoring');

function makeService(overrides: {
  tiers?: unknown[];
  getEffectiveModel?: jest.Mock;
  getAuthType?: jest.Mock;
  hasActiveProvider?: jest.Mock;
  isModelAvailable?: jest.Mock;
  activeSpecificity?: unknown[];
  getModelForAgent?: jest.Mock;
  getByModel?: jest.Mock;
}) {
  const tierService: TierService = {
    getTiers: jest.fn().mockResolvedValue(overrides.tiers ?? []),
  } as unknown as TierService;

  const providerKeyService: ProviderKeyService = {
    getEffectiveModel: overrides.getEffectiveModel ?? jest.fn().mockResolvedValue(null),
    getAuthType: overrides.getAuthType ?? jest.fn().mockResolvedValue('api_key'),
    hasActiveProvider: overrides.hasActiveProvider ?? jest.fn().mockResolvedValue(false),
    isModelAvailable: overrides.isModelAvailable ?? jest.fn().mockResolvedValue(true),
  } as unknown as ProviderKeyService;

  const specificityService: SpecificityService = {
    getActiveAssignments: jest.fn().mockResolvedValue(overrides.activeSpecificity ?? []),
  } as unknown as SpecificityService;

  const discoveryService: ModelDiscoveryService = {
    getModelForAgent: overrides.getModelForAgent ?? jest.fn().mockResolvedValue(null),
  } as unknown as ModelDiscoveryService;

  const pricingCache: ModelPricingCacheService = {
    getByModel: overrides.getByModel ?? jest.fn().mockReturnValue(null),
  } as unknown as ModelPricingCacheService;

  const penaltyService: SpecificityPenaltyService = {
    getPenaltiesForAgent: jest.fn().mockResolvedValue(new Map()),
  } as unknown as SpecificityPenaltyService;

  const svc = new ResolveService(
    tierService,
    providerKeyService,
    specificityService,
    pricingCache,
    discoveryService,
    penaltyService,
  );
  return {
    svc,
    tierService,
    providerKeyService,
    specificityService,
    discoveryService,
    pricingCache,
    penaltyService,
  };
}

describe('ResolveService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -- resolve() via specificity path --

  describe('specificity path', () => {
    it('is skipped when no specificity assignments are active', async () => {
      scoring.scoreRequest.mockReturnValue({
        tier: 'simple',
        confidence: 1,
        score: 0,
        reason: 'scored',
      });
      scoring.scanMessages.mockReturnValue(null);
      const { svc } = makeService({ tiers: [] });
      const out = await svc.resolve('agent-1', [{ role: 'user', content: 'hi' }]);
      expect(out.tier).toBe('simple');
      expect(out.reason).toBe('scored');
      expect(scoring.scoreRequest).toHaveBeenCalled();
    });

    it('is skipped when scanMessages returns no match', async () => {
      scoring.scoreRequest.mockReturnValue({
        tier: 'standard',
        confidence: 0.5,
        score: 10,
        reason: 'scored',
      });
      scoring.scanMessages.mockReturnValue(null);
      const { svc } = makeService({
        activeSpecificity: [{ category: 'coding', override_model: 'x', auto_assigned_model: 'x' }],
      });
      const out = await svc.resolve('agent-1', [{ role: 'user', content: 'hi' }]);
      expect(out.reason).toBe('scored');
    });

    it('returns null (falls through) when the detected category has no matching assignment', async () => {
      scoring.scoreRequest.mockReturnValue({
        tier: 'simple',
        confidence: 1,
        score: 0,
        reason: 'scored',
      });
      scoring.scanMessages.mockReturnValue({ category: 'trading', confidence: 0.8 });
      const { svc } = makeService({
        activeSpecificity: [{ category: 'coding', override_model: 'x', auto_assigned_model: 'x' }],
      });
      const out = await svc.resolve('agent-1', [{ role: 'user', content: 'hi' }]);
      expect(out.reason).toBe('scored');
    });

    it('falls through when the matching assignment has no model configured', async () => {
      scoring.scoreRequest.mockReturnValue({
        tier: 'simple',
        confidence: 1,
        score: 0,
        reason: 'scored',
      });
      scoring.scanMessages.mockReturnValue({ category: 'coding', confidence: 0.8 });
      const { svc } = makeService({
        activeSpecificity: [
          { category: 'coding', override_model: null, auto_assigned_model: null },
        ],
      });
      const out = await svc.resolve('agent-1', [{ role: 'user', content: 'hi' }]);
      expect(out.reason).toBe('scored');
    });

    it('falls through to tier routing when the specificity override points to an unavailable model (#1603)', async () => {
      scoring.scoreRequest.mockReturnValue({
        tier: 'simple',
        confidence: 1,
        score: 0,
        reason: 'scored',
      });
      scoring.scanMessages.mockReturnValue({ category: 'coding', confidence: 0.9 });
      const isModelAvailable = jest.fn().mockResolvedValue(false);
      const { svc } = makeService({
        activeSpecificity: [
          {
            category: 'coding',
            override_model: 'custom:deleted-uuid/gemini-2.5-flash-lite',
            override_provider: 'custom:deleted-uuid',
            auto_assigned_model: null,
          },
        ],
        tiers: [
          {
            tier: 'simple',
            override_model: null,
            auto_assigned_model: 'openai/gpt-5-mini',
            override_provider: null,
            override_auth_type: null,
          },
        ],
        isModelAvailable,
        getEffectiveModel: jest.fn().mockResolvedValue('openai/gpt-5-mini'),
        hasActiveProvider: jest.fn().mockResolvedValue(true),
      });
      const out = await svc.resolve('agent-1', [{ role: 'user', content: 'write code' }]);
      expect(isModelAvailable).toHaveBeenCalledWith(
        'agent-1',
        'custom:deleted-uuid/gemini-2.5-flash-lite',
      );
      expect(out.reason).toBe('scored');
      expect(out.model).toBe('openai/gpt-5-mini');
      expect(out.provider).toBe('openai');
    });

    it('uses auto_assigned_model when override_model is null on a specificity assignment', async () => {
      scoring.scanMessages.mockReturnValue({ category: 'coding', confidence: 0.8 });
      const { svc } = makeService({
        activeSpecificity: [
          {
            category: 'coding',
            override_model: null,
            auto_assigned_model: 'openai/gpt-5',
            override_provider: null,
          },
        ],
        hasActiveProvider: jest.fn().mockResolvedValue(true),
      });
      const out = await svc.resolve('agent-1', [{ role: 'user', content: 'code' }]);
      expect(out.reason).toBe('specificity');
      expect(out.model).toBe('openai/gpt-5');
    });

    it('returns a specificity response with provider=null and no auth_type when the model cannot be attributed to any provider', async () => {
      // Exercises the `provider ? ... : undefined` branch in resolveSpecificity where
      // resolveProvider returns null — the call still surfaces the specificity category
      // + model, but auth_type is omitted because there's no provider to look it up for.
      scoring.scanMessages.mockReturnValue({ category: 'coding', confidence: 0.9 });
      const getAuthType = jest.fn().mockResolvedValue('api_key');
      const { svc } = makeService({
        activeSpecificity: [
          {
            category: 'coding',
            override_model: 'unresolvable-model',
            auto_assigned_model: null,
            override_provider: null,
            override_auth_type: null,
          },
        ],
        // no prefix match, no discovered model, no pricing entry → provider resolves to null
        hasActiveProvider: jest.fn().mockResolvedValue(false),
        getModelForAgent: jest.fn().mockResolvedValue(null),
        getByModel: jest.fn().mockReturnValue(null),
        getAuthType,
      });
      const out = await svc.resolve('agent-1', [{ role: 'user', content: 'code' }]);
      expect(out.reason).toBe('specificity');
      expect(out.model).toBe('unresolvable-model');
      expect(out.provider).toBeNull();
      expect(out.auth_type).toBeUndefined();
      expect(getAuthType).not.toHaveBeenCalled();
    });

    it('uses override_auth_type directly when the specificity assignment pins one (skips getAuthType)', async () => {
      scoring.scanMessages.mockReturnValue({ category: 'coding', confidence: 0.9 });
      const hasActiveProvider = jest.fn().mockResolvedValue(true);
      const getAuthType = jest.fn().mockResolvedValue('api_key');
      const { svc } = makeService({
        activeSpecificity: [
          {
            category: 'coding',
            override_model: 'anthropic/claude-opus-4',
            auto_assigned_model: null,
            override_provider: null,
            override_auth_type: 'subscription',
          },
        ],
        hasActiveProvider,
        getAuthType,
      });
      const out = await svc.resolve('agent-1', [{ role: 'user', content: 'write some code' }]);
      expect(out.reason).toBe('specificity');
      expect(out.auth_type).toBe('subscription');
      // getAuthType must not be called when override_auth_type is set
      expect(getAuthType).not.toHaveBeenCalled();
    });

    it('falls through to complexity routing when the detected confidence is below the gate', async () => {
      // A confidence of 0.33 is the typical single-keyword result and used to
      // misroute coding sessions in discussion #1613. The gate at 0.4 forces
      // this weak detection back to complexity scoring.
      scoring.scanMessages.mockReturnValue({ category: 'coding', confidence: 0.33 });
      scoring.scoreRequest.mockReturnValue({
        tier: 'simple',
        confidence: 1,
        score: 0,
        reason: 'scored',
      });
      const { svc } = makeService({
        activeSpecificity: [{ category: 'coding', override_model: 'x', auto_assigned_model: 'x' }],
      });
      const out = await svc.resolve('agent-1', [{ role: 'user', content: 'hi' }]);
      expect(out.reason).toBe('scored');
      expect(scoring.scoreRequest).toHaveBeenCalled();
    });

    it('bypasses the confidence gate when a header override is supplied', async () => {
      // Headers are explicit user intent — low confidence still routes.
      scoring.scanMessages.mockReturnValue({ category: 'coding', confidence: 0.1 });
      const { svc } = makeService({
        activeSpecificity: [
          {
            category: 'coding',
            override_model: 'anthropic/claude-opus-4',
            auto_assigned_model: null,
            override_provider: null,
          },
        ],
        hasActiveProvider: jest.fn().mockResolvedValue(true),
        getAuthType: jest.fn().mockResolvedValue('api_key'),
      });
      const out = await svc.resolve(
        'agent-1',
        [{ role: 'user', content: 'hi' }],
        undefined,
        undefined,
        undefined,
        undefined,
        'coding',
      );
      expect(out.reason).toBe('specificity');
      expect(out.model).toBe('anthropic/claude-opus-4');
    });

    it('passes penalties from the penalty service through to scanMessages', async () => {
      scoring.scanMessages.mockReturnValue(null);
      scoring.scoreRequest.mockReturnValue({
        tier: 'simple',
        confidence: 1,
        score: 0,
        reason: 'scored',
      });
      const penalties = new Map([['web_browsing' as const, 2.25]]);
      const { svc, penaltyService } = makeService({
        activeSpecificity: [{ category: 'coding', override_model: 'x', auto_assigned_model: 'x' }],
      });
      (penaltyService.getPenaltiesForAgent as jest.Mock).mockResolvedValue(penalties);
      await svc.resolve('agent-1', [{ role: 'user', content: 'hi' }]);
      // scanMessages receives penalties because the map is non-empty.
      expect(scoring.scanMessages).toHaveBeenCalledWith(
        [{ role: 'user', content: 'hi' }],
        undefined,
        undefined,
        undefined,
        penalties,
      );
    });

    it('omits the penalty argument to scanMessages when the map is empty', async () => {
      scoring.scanMessages.mockReturnValue(null);
      scoring.scoreRequest.mockReturnValue({
        tier: 'simple',
        confidence: 1,
        score: 0,
        reason: 'scored',
      });
      const { svc, penaltyService } = makeService({
        activeSpecificity: [{ category: 'coding', override_model: 'x', auto_assigned_model: 'x' }],
      });
      (penaltyService.getPenaltiesForAgent as jest.Mock).mockResolvedValue(new Map());
      await svc.resolve('agent-1', [{ role: 'user', content: 'hi' }]);
      expect(scoring.scanMessages).toHaveBeenCalledWith(
        [{ role: 'user', content: 'hi' }],
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });

    it('returns the specificity response with provider + auth type when a match hits', async () => {
      scoring.scanMessages.mockReturnValue({ category: 'coding', confidence: 0.9 });
      const hasActiveProvider = jest.fn().mockResolvedValue(true);
      const getAuthType = jest.fn().mockResolvedValue('subscription');
      const { svc } = makeService({
        activeSpecificity: [
          {
            category: 'coding',
            override_model: 'anthropic/claude-opus-4',
            auto_assigned_model: null,
            override_provider: null,
            fallback_models: ['anthropic/claude-sonnet-4'],
          },
        ],
        hasActiveProvider,
        getAuthType,
      });
      const out = await svc.resolve('agent-1', [{ role: 'user', content: 'write some code' }]);
      expect(out.tier).toBe('standard');
      expect(out.reason).toBe('specificity');
      expect(out.model).toBe('anthropic/claude-opus-4');
      expect(out.provider).toBe('anthropic');
      expect(out.auth_type).toBe('subscription');
      expect(out.specificity_category).toBe('coding');
      expect(out.fallback_models).toEqual(['anthropic/claude-sonnet-4']);
      expect(scoring.scoreRequest).not.toHaveBeenCalled();
    });
  });

  // -- resolve() complexity path --

  describe('complexity path', () => {
    beforeEach(() => {
      scoring.scanMessages.mockReturnValue(null);
    });

    it('returns a blank-model response when no tier assignment exists for the scored tier', async () => {
      scoring.scoreRequest.mockReturnValue({
        tier: 'complex',
        confidence: 0.7,
        score: 50,
        reason: 'scored',
      });
      const { svc } = makeService({ tiers: [{ tier: 'simple' }] });
      const out = await svc.resolve('agent-1', [{ role: 'user', content: 'hi' }]);
      expect(out.model).toBeNull();
      expect(out.provider).toBeNull();
      expect(out.tier).toBe('complex');
    });

    it('returns a blank-model response when getEffectiveModel returns null', async () => {
      scoring.scoreRequest.mockReturnValue({
        tier: 'standard',
        confidence: 0.5,
        score: 20,
        reason: 'scored',
      });
      const { svc } = makeService({
        tiers: [{ tier: 'standard', override_model: null, auto_assigned_model: null }],
        getEffectiveModel: jest.fn().mockResolvedValue(null),
      });
      const out = await svc.resolve('agent-1', [{ role: 'user', content: 'x' }]);
      expect(out.model).toBeNull();
      expect(out.provider).toBeNull();
    });

    it('returns the resolved model + provider when the tier has an active provider', async () => {
      scoring.scoreRequest.mockReturnValue({
        tier: 'reasoning',
        confidence: 0.9,
        score: 90,
        reason: 'scored',
      });
      const { svc } = makeService({
        tiers: [
          {
            tier: 'reasoning',
            override_model: null,
            auto_assigned_model: 'openai/o1',
            override_provider: null,
            override_auth_type: null,
          },
        ],
        getEffectiveModel: jest.fn().mockResolvedValue('openai/o1'),
        hasActiveProvider: jest.fn().mockResolvedValue(true),
        getAuthType: jest.fn().mockResolvedValue('api_key'),
      });
      const out = await svc.resolve(
        'agent-1',
        [{ role: 'user', content: 'x' }],
        undefined,
        undefined,
        undefined,
        ['simple', 'standard'],
      );
      expect(out.model).toBe('openai/o1');
      expect(out.provider).toBe('openai');
      expect(out.auth_type).toBe('api_key');
    });

    it('respects override_provider when the assignment explicitly pins one', async () => {
      scoring.scoreRequest.mockReturnValue({
        tier: 'standard',
        confidence: 0.5,
        score: 20,
        reason: 'scored',
      });
      const { svc } = makeService({
        tiers: [
          {
            tier: 'standard',
            override_model: 'custom-model',
            override_provider: 'openrouter',
            auto_assigned_model: null,
            override_auth_type: null,
          },
        ],
        getEffectiveModel: jest.fn().mockResolvedValue('custom-model'),
        getAuthType: jest.fn().mockResolvedValue('api_key'),
      });
      const out = await svc.resolve('agent-1', [{ role: 'user', content: 'hi' }]);
      expect(out.provider).toBe('openrouter');
    });

    it('falls back to discovered models when prefix inference misses or provider not connected', async () => {
      scoring.scoreRequest.mockReturnValue({
        tier: 'simple',
        confidence: 1,
        score: 0,
        reason: 'scored',
      });
      const { svc } = makeService({
        tiers: [
          {
            tier: 'simple',
            override_model: null,
            auto_assigned_model: 'weird-model',
            override_provider: null,
            override_auth_type: null,
          },
        ],
        getEffectiveModel: jest.fn().mockResolvedValue('weird-model'),
        hasActiveProvider: jest.fn().mockResolvedValue(false),
        getModelForAgent: jest.fn().mockResolvedValue({ provider: 'xyz' }),
        getAuthType: jest.fn().mockResolvedValue('api_key'),
      });
      const out = await svc.resolve('agent-1', [{ role: 'user', content: 'x' }]);
      expect(out.provider).toBe('xyz');
    });

    it('falls back to pricing cache (ignoring OpenRouter entries) as a last resort', async () => {
      scoring.scoreRequest.mockReturnValue({
        tier: 'simple',
        confidence: 1,
        score: 0,
        reason: 'scored',
      });
      const { svc } = makeService({
        tiers: [
          {
            tier: 'simple',
            override_model: null,
            auto_assigned_model: 'rare-model',
            override_provider: null,
            override_auth_type: null,
          },
        ],
        getEffectiveModel: jest.fn().mockResolvedValue('rare-model'),
        hasActiveProvider: jest.fn().mockResolvedValue(false),
        getModelForAgent: jest.fn().mockResolvedValue(null),
        getByModel: jest.fn().mockReturnValue({ provider: 'Anthropic' }),
        getAuthType: jest.fn().mockResolvedValue('api_key'),
      });
      const out = await svc.resolve('agent-1', [{ role: 'user', content: 'x' }]);
      expect(out.provider).toBe('Anthropic');
    });

    it('returns provider=null when pricing cache only has an OpenRouter entry (ambiguous attribution)', async () => {
      scoring.scoreRequest.mockReturnValue({
        tier: 'simple',
        confidence: 1,
        score: 0,
        reason: 'scored',
      });
      const { svc } = makeService({
        tiers: [
          {
            tier: 'simple',
            override_model: null,
            auto_assigned_model: 'only-on-openrouter',
            override_provider: null,
            override_auth_type: null,
          },
        ],
        getEffectiveModel: jest.fn().mockResolvedValue('only-on-openrouter'),
        hasActiveProvider: jest.fn().mockResolvedValue(false),
        getModelForAgent: jest.fn().mockResolvedValue(null),
        getByModel: jest.fn().mockReturnValue({ provider: 'OpenRouter' }),
      });
      const out = await svc.resolve('agent-1', [{ role: 'user', content: 'x' }]);
      expect(out.provider).toBeNull();
      expect(out.auth_type).toBeUndefined();
    });
  });

  // -- resolveForTier (heartbeat path) --

  describe('resolveForTier', () => {
    it('returns a heartbeat response with a null model when the tier has no assignment', async () => {
      const { svc } = makeService({ tiers: [] });
      const out = await svc.resolveForTier('agent-1', 'simple');
      expect(out).toEqual({
        tier: 'simple',
        model: null,
        provider: null,
        confidence: 1,
        score: 0,
        reason: 'heartbeat',
      });
    });

    it('returns a heartbeat response populated with model + provider when available', async () => {
      const { svc } = makeService({
        tiers: [
          {
            tier: 'simple',
            override_model: null,
            auto_assigned_model: 'openai/gpt-5-mini',
            override_provider: null,
            override_auth_type: null,
          },
        ],
        getEffectiveModel: jest.fn().mockResolvedValue('openai/gpt-5-mini'),
        hasActiveProvider: jest.fn().mockResolvedValue(true),
        getAuthType: jest.fn().mockResolvedValue('api_key'),
      });
      const out = await svc.resolveForTier('agent-1', 'simple');
      expect(out.reason).toBe('heartbeat');
      expect(out.model).toBe('openai/gpt-5-mini');
      expect(out.provider).toBe('openai');
      expect(out.auth_type).toBe('api_key');
    });
  });
});
