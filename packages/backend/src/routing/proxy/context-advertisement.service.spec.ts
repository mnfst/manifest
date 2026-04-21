/**
 * Why these tests exist:
 *
 * Issues #1617 / #1612 / #1450 all trace back to clients hard-coding a
 * context window that didn't match whichever model manifest/auto actually
 * routed to — either too small (aggressive compaction wasted tokens) or too
 * large (requests overflowed the routed model). Phase 1 advertises the
 * **minimum** context window across every model the agent can be routed to.
 * These tests defend that invariant: if ContextAdvertisementService ever
 * returns the max, the sum, or "whatever the first tier says", the three
 * bugs we fixed come back. Every test here checks a real code path that
 * guards one of those three failure modes.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ContextAdvertisementService,
  DEFAULT_ADVERTISED_CONTEXT,
} from './context-advertisement.service';
import { Agent } from '../../entities/agent.entity';
import { TierService } from '../routing-core/tier.service';
import { SpecificityService } from '../routing-core/specificity.service';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import { DiscoveredModel } from '../../model-discovery/model-fetcher';

function mkModel(id: string, contextWindow: number): DiscoveredModel {
  return {
    id,
    displayName: id,
    provider: 'openai',
    contextWindow,
    inputPricePerToken: 0,
    outputPricePerToken: 0,
    capabilityReasoning: false,
    capabilityCode: true,
    qualityScore: 3,
  };
}

interface ContextSvcDeps {
  findOne?: jest.Mock;
  getTiers?: jest.Mock;
  getActiveAssignments?: jest.Mock;
  getModelForAgent?: jest.Mock;
}

async function makeService(overrides: ContextSvcDeps = {}): Promise<{
  service: ContextAdvertisementService;
  findOne: jest.Mock;
  getTiers: jest.Mock;
  getActiveAssignments: jest.Mock;
  getModelForAgent: jest.Mock;
}> {
  const findOne = overrides.findOne ?? jest.fn().mockResolvedValue(null);
  const getTiers = overrides.getTiers ?? jest.fn().mockResolvedValue([]);
  const getActiveAssignments = overrides.getActiveAssignments ?? jest.fn().mockResolvedValue([]);
  const getModelForAgent = overrides.getModelForAgent ?? jest.fn().mockResolvedValue(null);

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ContextAdvertisementService,
      {
        provide: getRepositoryToken(Agent),
        useValue: { findOne },
      },
      { provide: TierService, useValue: { getTiers } },
      { provide: SpecificityService, useValue: { getActiveAssignments } },
      { provide: ModelDiscoveryService, useValue: { getModelForAgent } },
    ],
  }).compile();

  return {
    service: module.get<ContextAdvertisementService>(ContextAdvertisementService),
    findOne,
    getTiers,
    getActiveAssignments,
    getModelForAgent,
  };
}

describe('ContextAdvertisementService', () => {
  describe('agent override', () => {
    it('returns the override verbatim when agent.context_floor_override is set', async () => {
      const { service, findOne, getTiers, getModelForAgent } = await makeService({
        findOne: jest.fn().mockResolvedValue({ context_floor_override: 50_000 }),
      });

      const result = await service.getEffectiveContext('agent-1');

      expect(result).toEqual({ contextLength: 50_000, overridden: true });
      expect(findOne).toHaveBeenCalledWith({ where: { id: 'agent-1' } });
      // Override short-circuits discovery — don't pay for it.
      expect(getTiers).not.toHaveBeenCalled();
      expect(getModelForAgent).not.toHaveBeenCalled();
    });

    it('ignores a zero override (falsy) and computes from models instead', async () => {
      // context_floor_override is typed as `number | null`; 0 is in range for
      // `integer` so it is worth confirming the guard treats 0/null the same
      // way: fall through to the computed floor.
      const { service, getTiers } = await makeService({
        findOne: jest.fn().mockResolvedValue({ context_floor_override: 0 }),
        getTiers: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getEffectiveContext('agent-1');

      expect(result).toEqual({
        contextLength: DEFAULT_ADVERTISED_CONTEXT,
        overridden: false,
      });
      expect(getTiers).toHaveBeenCalled();
    });

    it('treats a null override as "use the computed floor"', async () => {
      const { service } = await makeService({
        findOne: jest.fn().mockResolvedValue({ context_floor_override: null }),
      });

      const result = await service.getEffectiveContext('agent-1');

      expect(result.overridden).toBe(false);
    });

    it('treats a missing agent row the same as no override', async () => {
      // Covers the `agent?.context_floor_override` optional-chain path when
      // findOne returns null.
      const { service } = await makeService({
        findOne: jest.fn().mockResolvedValue(null),
      });

      const result = await service.getEffectiveContext('ghost');

      expect(result).toEqual({
        contextLength: DEFAULT_ADVERTISED_CONTEXT,
        overridden: false,
      });
    });
  });

  describe('empty-candidate fallback', () => {
    it('falls back to DEFAULT_ADVERTISED_CONTEXT when no tiers and no specificity are configured', async () => {
      // This is the onboarding state: user just created the agent, no
      // providers connected yet. Advertising 128K keeps OpenClaw etc. from
      // compacting to the hard-coded 16K floor they fell back to before.
      const { service } = await makeService({
        getTiers: jest.fn().mockResolvedValue([]),
        getActiveAssignments: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getEffectiveContext('new-agent');

      expect(result).toEqual({
        contextLength: DEFAULT_ADVERTISED_CONTEXT,
        overridden: false,
      });
    });

    it('falls back to DEFAULT_ADVERTISED_CONTEXT when discovery returns nothing for every candidate', async () => {
      // Stale tier assignments pointing at models the discovery cache no
      // longer knows about. We don't want to return `Math.min()` === Infinity.
      const { service } = await makeService({
        getTiers: jest
          .fn()
          .mockResolvedValue([
            { auto_assigned_model: 'ghost-model', override_model: null, fallback_models: null },
          ]),
        getModelForAgent: jest.fn().mockResolvedValue(undefined),
      });

      const result = await service.getEffectiveContext('agent-1');

      expect(result).toEqual({
        contextLength: DEFAULT_ADVERTISED_CONTEXT,
        overridden: false,
      });
    });

    it('ignores models whose contextWindow is zero or negative', async () => {
      // Guard against bad data in cached_models. A model with contextWindow=0
      // must never drag the advertised floor down to 0.
      const { service } = await makeService({
        getTiers: jest.fn().mockResolvedValue([
          {
            auto_assigned_model: 'broken',
            override_model: null,
            fallback_models: ['also-broken'],
          },
        ]),
        getModelForAgent: jest.fn().mockImplementation((_agentId, modelId) => {
          if (modelId === 'broken') return Promise.resolve(mkModel('broken', 0));
          if (modelId === 'also-broken') return Promise.resolve(mkModel('also-broken', -1));
          return Promise.resolve(null);
        }),
      });

      const result = await service.getEffectiveContext('agent-1');

      expect(result).toEqual({
        contextLength: DEFAULT_ADVERTISED_CONTEXT,
        overridden: false,
      });
    });
  });

  describe('minimum-context behaviour (the whole point of the feature)', () => {
    it('returns the smallest context_window across tier primaries and fallbacks', async () => {
      // This is the core defense against #1617: when a tier primary has a
      // 200K window but the fallback only has 128K, we must advertise 128K
      // so the client never overflows the fallback on a failover.
      const { service } = await makeService({
        getTiers: jest.fn().mockResolvedValue([
          {
            auto_assigned_model: 'claude-opus-4-6',
            override_model: null,
            fallback_models: ['gpt-4o-mini'],
          },
        ]),
        getModelForAgent: jest.fn().mockImplementation((_agentId, modelId) => {
          if (modelId === 'claude-opus-4-6')
            return Promise.resolve(mkModel('claude-opus-4-6', 200_000));
          if (modelId === 'gpt-4o-mini') return Promise.resolve(mkModel('gpt-4o-mini', 128_000));
          return Promise.resolve(null);
        }),
      });

      const result = await service.getEffectiveContext('agent-1');

      expect(result).toEqual({ contextLength: 128_000, overridden: false });
    });

    it('prefers override_model over auto_assigned_model when both are set', async () => {
      // Matches the `tier.override_model ?? tier.auto_assigned_model` rule:
      // a user pinned a different model, so that's the one we have to honour.
      const { service, getModelForAgent } = await makeService({
        getTiers: jest.fn().mockResolvedValue([
          {
            auto_assigned_model: 'auto-model',
            override_model: 'pinned-model',
            fallback_models: null,
          },
        ]),
        getModelForAgent: jest.fn().mockImplementation((_agentId, modelId) => {
          if (modelId === 'pinned-model') return Promise.resolve(mkModel('pinned-model', 64_000));
          return Promise.resolve(null);
        }),
      });

      const result = await service.getEffectiveContext('agent-1');

      expect(result.contextLength).toBe(64_000);
      // We must never look up the auto-assigned one when an override exists.
      const lookedUp = getModelForAgent.mock.calls.map((c) => c[1]);
      expect(lookedUp).toContain('pinned-model');
      expect(lookedUp).not.toContain('auto-model');
    });

    it('includes specificity assignments in the candidate set', async () => {
      // Bug class from #1612: when the agent is routed via specificity to a
      // smaller-window model (e.g. a coding-specific one), the advertised
      // floor had to account for it. If we ignored specificity we'd over-
      // advertise and OpenClaw would overflow the coding model.
      const { service } = await makeService({
        getTiers: jest.fn().mockResolvedValue([
          {
            auto_assigned_model: 'big-model',
            override_model: null,
            fallback_models: null,
          },
        ]),
        getActiveAssignments: jest.fn().mockResolvedValue([
          {
            auto_assigned_model: 'small-coding-model',
            override_model: null,
            fallback_models: ['medium-fallback'],
          },
        ]),
        getModelForAgent: jest.fn().mockImplementation((_agentId, modelId) => {
          if (modelId === 'big-model') return Promise.resolve(mkModel('big-model', 1_000_000));
          if (modelId === 'small-coding-model')
            return Promise.resolve(mkModel('small-coding-model', 32_000));
          if (modelId === 'medium-fallback')
            return Promise.resolve(mkModel('medium-fallback', 128_000));
          return Promise.resolve(null);
        }),
      });

      const result = await service.getEffectiveContext('agent-1');

      expect(result).toEqual({ contextLength: 32_000, overridden: false });
    });

    it('uses override_model for specificity assignments when set', async () => {
      // Same override-wins rule, on the specificity side. Exercises the
      // `assignment.override_model ?? assignment.auto_assigned_model` line.
      const { service } = await makeService({
        getActiveAssignments: jest.fn().mockResolvedValue([
          {
            auto_assigned_model: 'auto-spec',
            override_model: 'pinned-spec',
            fallback_models: null,
          },
        ]),
        getModelForAgent: jest.fn().mockImplementation((_agentId, modelId) => {
          if (modelId === 'pinned-spec') return Promise.resolve(mkModel('pinned-spec', 96_000));
          return Promise.resolve(null);
        }),
      });

      const result = await service.getEffectiveContext('agent-1');

      expect(result.contextLength).toBe(96_000);
    });

    it('dedupes identical model ids across tiers and specificity so they only cost one lookup', async () => {
      // Same model appears as both a tier primary and a specificity
      // fallback. The internal Set must collapse it — we don't want to
      // query the discovery service twice per request for the same model.
      const getModelForAgent = jest.fn().mockResolvedValue(mkModel('gpt-4o', 128_000));
      const { service } = await makeService({
        getTiers: jest.fn().mockResolvedValue([
          {
            auto_assigned_model: 'gpt-4o',
            override_model: null,
            fallback_models: ['gpt-4o'],
          },
        ]),
        getActiveAssignments: jest.fn().mockResolvedValue([
          {
            auto_assigned_model: 'gpt-4o',
            override_model: null,
            fallback_models: ['gpt-4o'],
          },
        ]),
        getModelForAgent,
      });

      await service.getEffectiveContext('agent-1');

      expect(getModelForAgent).toHaveBeenCalledTimes(1);
      expect(getModelForAgent).toHaveBeenCalledWith('agent-1', 'gpt-4o');
    });

    it('skips tiers whose primary is null and has no fallbacks', async () => {
      // Covers the `if (primary) models.add(primary)` and the null-safety on
      // fallback_models together — an unconfigured tier should contribute
      // zero candidates, not crash.
      const { service } = await makeService({
        getTiers: jest.fn().mockResolvedValue([
          {
            auto_assigned_model: null,
            override_model: null,
            fallback_models: null,
          },
          {
            auto_assigned_model: 'only-real',
            override_model: null,
            fallback_models: null,
          },
        ]),
        getModelForAgent: jest.fn().mockResolvedValue(mkModel('only-real', 42_000)),
      });

      const result = await service.getEffectiveContext('agent-1');

      expect(result.contextLength).toBe(42_000);
    });

    it('skips specificity assignments whose primary is null and fallbacks are null', async () => {
      // Mirrors the tier test but on the specificity branch so the
      // equivalent `if (primary)` / `if (assignment.fallback_models)` guards
      // are both covered.
      const { service } = await makeService({
        getActiveAssignments: jest.fn().mockResolvedValue([
          {
            auto_assigned_model: null,
            override_model: null,
            fallback_models: null,
          },
          {
            auto_assigned_model: 'spec-real',
            override_model: null,
            fallback_models: null,
          },
        ]),
        getModelForAgent: jest.fn().mockResolvedValue(mkModel('spec-real', 70_000)),
      });

      const result = await service.getEffectiveContext('agent-1');

      expect(result.contextLength).toBe(70_000);
    });
  });
});
