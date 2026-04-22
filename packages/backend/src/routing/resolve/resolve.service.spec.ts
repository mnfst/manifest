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
  getModelsForAgent?: jest.Mock;
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
    getModelsForAgent: overrides.getModelsForAgent ?? jest.fn().mockResolvedValue([]),
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

  /**
   * Phase 2 — size-aware resolution. The scored tier might contain models
   * too small for the incoming request; we filter by context window,
   * escalate one tier up if nothing in the scored tier fits, and return a
   * structured `context_window_exceeded` response when no tier can
   * handle the payload. See #1617 / #1612 / #1450.
   */
  describe('size-aware resolution', () => {
    const tierWith = (tier: string, primary: string, fallbacks: string[] = []) => ({
      tier,
      override_model: null,
      auto_assigned_model: primary,
      override_provider: null,
      override_auth_type: null,
      fallback_models: fallbacks.length > 0 ? fallbacks : null,
    });
    const discoveredModel = (id: string, contextWindow: number) => ({
      id,
      displayName: id,
      provider: 'openai',
      contextWindow,
      inputPricePerToken: 0,
      outputPricePerToken: 0,
      capabilityReasoning: false,
      capabilityCode: true,
      qualityScore: 3,
    });

    beforeEach(() => {
      scoring.scoreRequest.mockReturnValue({
        tier: 'standard',
        confidence: 0.8,
        score: 20,
        reason: 'scored',
      });
      scoring.scanMessages.mockReturnValue(null);
    });

    it('keeps the scored-tier primary when it fits — the happy path for normal-size requests', async () => {
      const { svc } = makeService({
        tiers: [tierWith('standard', 'gpt-4o-mini', ['claude-opus-4-6'])],
        getModelsForAgent: jest
          .fn()
          .mockResolvedValue([
            discoveredModel('gpt-4o-mini', 128_000),
            discoveredModel('claude-opus-4-6', 200_000),
          ]),
        hasActiveProvider: jest.fn().mockResolvedValue(true),
      });

      const out = await svc.resolve(
        'agent-1',
        [{ role: 'user', content: 'hi' }],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        50_000,
      );

      expect(out.model).toBe('gpt-4o-mini');
      expect(out.tier).toBe('standard');
      expect(out.reason).toBe('scored');
      expect(out.size_escalated_from).toBeUndefined();
      expect(out.estimated_tokens).toBe(50_000);
      expect(out.used_context_window).toBe(128_000);
    });

    it('skips a too-small primary and picks the fallback within the same tier — #1617 fuzhyperblue', async () => {
      const { svc } = makeService({
        tiers: [tierWith('standard', 'gpt-4o-mini', ['claude-opus-4-6'])],
        getModelsForAgent: jest
          .fn()
          .mockResolvedValue([
            discoveredModel('gpt-4o-mini', 128_000),
            discoveredModel('claude-opus-4-6', 200_000),
          ]),
        hasActiveProvider: jest.fn().mockResolvedValue(true),
      });

      const out = await svc.resolve(
        'agent-1',
        [{ role: 'user', content: 'big' }],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        150_000,
      );

      expect(out.model).toBe('claude-opus-4-6');
      expect(out.tier).toBe('standard'); // same tier, just walked the fallback chain
      expect(out.used_context_window).toBe(200_000);
    });

    it('escalates to the next tier when no model in the scored tier fits', async () => {
      const { svc } = makeService({
        tiers: [
          tierWith('standard', 'gpt-4o-mini'),
          tierWith('complex', 'claude-opus-4-6'),
          tierWith('reasoning', 'gemini-pro'),
        ],
        getModelsForAgent: jest
          .fn()
          .mockResolvedValue([
            discoveredModel('gpt-4o-mini', 128_000),
            discoveredModel('claude-opus-4-6', 200_000),
            discoveredModel('gemini-pro', 1_000_000),
          ]),
        hasActiveProvider: jest.fn().mockResolvedValue(true),
      });

      const out = await svc.resolve(
        'agent-1',
        [{ role: 'user', content: 'huge' }],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        150_000,
      );

      expect(out.model).toBe('claude-opus-4-6');
      expect(out.tier).toBe('complex');
      expect(out.size_escalated_from).toBe('standard');
      expect(out.reason).toBe('size_escalated');
    });

    it('honours body.max_tokens as the reserved output when present', async () => {
      const { svc } = makeService({
        tiers: [tierWith('standard', 'gpt-4o-mini', ['claude-opus-4-6'])],
        getModelsForAgent: jest
          .fn()
          .mockResolvedValue([
            discoveredModel('gpt-4o-mini', 128_000),
            discoveredModel('claude-opus-4-6', 200_000),
          ]),
        hasActiveProvider: jest.fn().mockResolvedValue(true),
      });

      // 120K estimated + 10K max_tokens = 130K needed. 128K primary should
      // be skipped, 200K fallback chosen.
      const out = await svc.resolve(
        'agent-1',
        [{ role: 'user', content: 'hi' }],
        undefined,
        undefined,
        10_000,
        undefined,
        undefined,
        undefined,
        120_000,
      );
      expect(out.model).toBe('claude-opus-4-6');
    });

    it('returns a context_window_exceeded response when no tier anywhere fits', async () => {
      const { svc } = makeService({
        tiers: [tierWith('standard', 'gpt-4o-mini'), tierWith('complex', 'claude-opus-4-6')],
        getModelsForAgent: jest
          .fn()
          .mockResolvedValue([
            discoveredModel('gpt-4o-mini', 128_000),
            discoveredModel('claude-opus-4-6', 200_000),
          ]),
      });

      const out = await svc.resolve(
        'agent-1',
        [{ role: 'user', content: 'gigantic' }],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        1_000_000,
      );

      expect(out.reason).toBe('context_window_exceeded');
      expect(out.model).toBeNull();
      expect(out.largest_available_context).toBe(200_000);
      expect(out.estimated_tokens).toBe(1_000_000);
    });

    it('falls back to legacy scored-tier behaviour when estimatedTokens is 0 (heartbeat / unknown)', async () => {
      const { svc } = makeService({
        tiers: [tierWith('standard', 'gpt-4o-mini')],
        getEffectiveModel: jest.fn().mockResolvedValue('gpt-4o-mini'),
        hasActiveProvider: jest.fn().mockResolvedValue(true),
      });

      const out = await svc.resolve(
        'agent-1',
        [{ role: 'user', content: 'hi' }],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        0,
      );

      expect(out.model).toBe('gpt-4o-mini');
      expect(out.estimated_tokens).toBeUndefined();
      expect(out.used_context_window).toBeUndefined();
    });

    it('ignores models discovery does not know about — they would fail at the provider anyway', async () => {
      // The tier points at 'ghost-model'. Discovery returns no entry for
      // it, so we pretend it doesn't exist and fall through to the next
      // candidate. Protects against stale tier assignments referring to
      // disconnected providers.
      const { svc } = makeService({
        tiers: [tierWith('standard', 'ghost-model', ['gpt-4o-mini'])],
        getModelsForAgent: jest.fn().mockResolvedValue([discoveredModel('gpt-4o-mini', 128_000)]),
        hasActiveProvider: jest.fn().mockResolvedValue(true),
      });

      const out = await svc.resolve(
        'agent-1',
        [{ role: 'user', content: 'hi' }],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        50_000,
      );

      expect(out.model).toBe('gpt-4o-mini');
    });

    it('dedupes a model that appears as both primary and a fallback in the same tier', async () => {
      // Uncommon but legal tier config: primary and the first fallback
      // reference the same model id. Walking the candidates with a Set
      // keeps us from probing the same model twice.
      const getModelsForAgent = jest
        .fn()
        .mockResolvedValue([discoveredModel('gpt-4o-mini', 128_000)]);
      const { svc } = makeService({
        tiers: [tierWith('standard', 'gpt-4o-mini', ['gpt-4o-mini'])],
        getModelsForAgent,
        hasActiveProvider: jest.fn().mockResolvedValue(true),
      });

      await svc.resolve(
        'agent-1',
        [{ role: 'user', content: 'hi' }],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        50_000,
      );

      expect(getModelsForAgent).toHaveBeenCalledTimes(1);
    });

    it('skips discovered models with a non-positive contextWindow — misconfigured providers', async () => {
      // Defensive: a provider whose cached_models row has contextWindow=0
      // should be treated as invisible, not as a model that "fits anything
      // under 0 tokens". Exercises the <= 0 guard in buildFitCandidates.
      const { svc } = makeService({
        tiers: [tierWith('standard', 'broken', ['gpt-4o-mini'])],
        getModelsForAgent: jest
          .fn()
          .mockResolvedValue([
            discoveredModel('broken', 0),
            discoveredModel('gpt-4o-mini', 128_000),
          ]),
        hasActiveProvider: jest.fn().mockResolvedValue(true),
      });

      const out = await svc.resolve(
        'agent-1',
        [{ role: 'user', content: 'hi' }],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        50_000,
      );

      // broken was filtered out, so we fell through to the fallback.
      expect(out.model).toBe('gpt-4o-mini');
    });

    it('preserves the scorer reason (not size_escalated) when the scored-tier primary fits — defends #1617 RFC wording', async () => {
      // Easy-to-regress invariant: the final `reason` literal on a happy-path
      // fit must be whatever the scorer returned (e.g. 'tool_detected',
      // 'scored'), NEVER 'size_escalated'. A refactor that rewrites the
      // `escalated ? REASON_SIZE_ESCALATED : scored.reason` ternary into an
      // unconditional REASON_SIZE_ESCALATED would silently make every
      // size-aware response claim it was escalated — confusing for anyone
      // analysing the reason column in agent_messages later.
      scoring.scoreRequest.mockReturnValue({
        tier: 'standard',
        confidence: 0.9,
        score: 30,
        reason: 'tool_detected',
      });
      const { svc } = makeService({
        tiers: [tierWith('standard', 'gpt-4o-mini')],
        getModelsForAgent: jest.fn().mockResolvedValue([discoveredModel('gpt-4o-mini', 128_000)]),
        hasActiveProvider: jest.fn().mockResolvedValue(true),
      });

      const out = await svc.resolve(
        'agent-1',
        [{ role: 'user', content: 'hi' }],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        10_000,
      );

      expect(out.reason).toBe('tool_detected');
      expect(out.reason).not.toBe('size_escalated');
      expect(out.size_escalated_from).toBeUndefined();
    });

    it('reports largest_available=0 when no model is discovered at all', async () => {
      // Pathological but reachable state: tier assignment exists but
      // discovery is empty. We still want a sane number in the error body
      // instead of `undefined` or `-Infinity`.
      const { svc } = makeService({
        tiers: [tierWith('standard', 'ghost-model')],
        getModelsForAgent: jest.fn().mockResolvedValue([]),
      });

      const out = await svc.resolve(
        'agent-1',
        [{ role: 'user', content: 'hi' }],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        50_000,
      );

      expect(out.reason).toBe('context_window_exceeded');
      expect(out.largest_available_context).toBe(0);
    });
  });
});
