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
import { HeaderTierService } from '../header-tiers/header-tier.service';
import { ModelPricingCacheService } from '../../model-prices/model-pricing-cache.service';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const scoring = require('../../scoring');

function buildService(opts: {
  complexityEnabled: boolean;
  defaultTier?: Record<string, unknown>;
  getEffectiveModel?: unknown;
}) {
  const tierService = {
    getTiers: jest
      .fn()
      .mockResolvedValue(
        opts.defaultTier
          ? [opts.defaultTier]
          : [{ tier: 'default', override_model: null, auto_assigned_model: null }],
      ),
    isComplexityEnabled: jest.fn().mockResolvedValue(opts.complexityEnabled),
  } as unknown as TierService;

  const providerKeyService = {
    getEffectiveModel: opts.getEffectiveModel ?? jest.fn().mockResolvedValue('openai/gpt-4o-mini'),
    getAuthType: jest.fn().mockResolvedValue('api_key'),
    hasActiveProvider: jest.fn().mockResolvedValue(true),
    isModelAvailable: jest.fn().mockResolvedValue(true),
  } as unknown as ProviderKeyService;

  const specificityService = {
    getActiveAssignments: jest.fn().mockResolvedValue([]),
  } as unknown as SpecificityService;

  return new ResolveService(
    tierService,
    providerKeyService,
    specificityService,
    {
      getByModel: jest.fn().mockReturnValue({ provider: 'OpenAI' }),
    } as unknown as ModelPricingCacheService,
    {
      getModelForAgent: jest.fn().mockResolvedValue(null),
    } as unknown as ModelDiscoveryService,
    {
      getPenaltiesForAgent: jest.fn().mockResolvedValue(new Map()),
    } as unknown as SpecificityPenaltyService,
    {
      list: jest.fn().mockResolvedValue([]),
    } as unknown as HeaderTierService,
  );
}

describe('ResolveService — complexity disabled routes through default tier', () => {
  beforeEach(() => jest.clearAllMocks());

  it('skips scoring and returns the default tier when complexity is off', async () => {
    scoring.scanMessages.mockReturnValue(null);
    const svc = buildService({
      complexityEnabled: false,
      defaultTier: {
        tier: 'default',
        override_model: null,
        auto_assigned_model: 'openai/gpt-4o-mini',
        override_provider: null,
        override_auth_type: null,
        fallback_models: ['openai/gpt-4o'],
      },
    });

    const out = await svc.resolve('agent-1', [{ role: 'user', content: 'anything' }]);

    expect(scoring.scoreRequest).not.toHaveBeenCalled();
    expect(out.tier).toBe('default');
    expect(out.reason).toBe('default');
    expect(out.model).toBe('openai/gpt-4o-mini');
    expect(out.fallback_models).toEqual(['openai/gpt-4o']);
  });

  it('still scores normally when complexity is on', async () => {
    scoring.scanMessages.mockReturnValue(null);
    scoring.scoreRequest.mockReturnValue({
      tier: 'simple',
      confidence: 1,
      score: 0,
      reason: 'scored',
    });
    const svc = buildService({
      complexityEnabled: true,
      defaultTier: {
        tier: 'simple',
        override_model: null,
        auto_assigned_model: 'openai/gpt-4o-mini',
        override_provider: null,
        override_auth_type: null,
      },
    });

    const out = await svc.resolve('agent-1', [{ role: 'user', content: 'hi' }]);

    expect(scoring.scoreRequest).toHaveBeenCalled();
    expect(out.tier).toBe('simple');
    expect(out.reason).toBe('scored');
  });

  it('returns a null model when the default tier has no resolvable model', async () => {
    scoring.scanMessages.mockReturnValue(null);
    const svc = buildService({
      complexityEnabled: false,
      getEffectiveModel: jest.fn().mockResolvedValue(null),
    });

    const out = await svc.resolve('agent-1', [{ role: 'user', content: 'hi' }]);

    expect(out.tier).toBe('default');
    expect(out.reason).toBe('default');
    expect(out.model).toBeNull();
    expect(out.provider).toBeNull();
  });
});
