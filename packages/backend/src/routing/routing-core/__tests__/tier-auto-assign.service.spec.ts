import type { Repository } from 'typeorm';
import { TierAutoAssignService } from '../tier-auto-assign.service';
import { TierAssignment } from '../../../entities/tier-assignment.entity';
import type { ModelDiscoveryService } from '../../../model-discovery/model-discovery.service';
import type { DiscoveredModel } from '../../../model-discovery/model-fetcher';

const mkModel = (overrides: Partial<DiscoveredModel>): DiscoveredModel =>
  ({
    id: overrides.id ?? 'm-1',
    displayName: overrides.displayName ?? overrides.id ?? 'm-1',
    provider: overrides.provider ?? 'openai',
    contextWindow: 128_000,
    inputPricePerToken: 0.001,
    outputPricePerToken: 0.002,
    capabilityReasoning: false,
    capabilityCode: false,
    qualityScore: 3,
    authType: 'api_key',
    ...overrides,
  }) as DiscoveredModel;

const makeRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  insert: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockImplementation(async (rows) => rows),
});

describe('TierAutoAssignService', () => {
  let discoveryService: jest.Mocked<Pick<ModelDiscoveryService, 'getModelsForAgent'>>;
  let tierRepo: ReturnType<typeof makeRepo>;
  let svc: TierAutoAssignService;

  beforeEach(() => {
    discoveryService = { getModelsForAgent: jest.fn().mockResolvedValue([]) };
    tierRepo = makeRepo();
    svc = new TierAutoAssignService(
      discoveryService as unknown as ModelDiscoveryService,
      tierRepo as unknown as Repository<TierAssignment>,
    );
  });

  describe('recalculate', () => {
    it('inserts auto-assigned routes for every slot when no existing tiers', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        mkModel({ id: 'gpt-4o', qualityScore: 4, capabilityCode: true }),
      ]);
      tierRepo.find.mockResolvedValue([]);

      await svc.recalculate('agent-1');
      expect(tierRepo.insert).toHaveBeenCalledTimes(1);
      const inserted = tierRepo.insert.mock.calls[0][0];
      expect(inserted).toHaveLength(5);
      expect(inserted.every((r: { auto_assigned_route: unknown }) => r.auto_assigned_route)).toBe(
        true,
      );
    });

    it('updates existing tier rows in-place via save', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        mkModel({ id: 'gpt-4o', qualityScore: 4, capabilityCode: true }),
      ]);
      const existing = [
        {
          tier: 'simple',
          auto_assigned_route: null,
        } as TierAssignment,
      ];
      tierRepo.find.mockResolvedValue(existing);

      await svc.recalculate('agent-1');
      // existing row was saved in-place, missing slots inserted.
      expect(tierRepo.save).toHaveBeenCalledTimes(1);
      expect(tierRepo.insert).toHaveBeenCalledTimes(1);
      expect(existing[0].auto_assigned_route).toEqual({
        provider: 'openai',
        authType: 'api_key',
        model: 'gpt-4o',
      });
    });

    it('partitions subscription vs api_key models — subscription gets priority', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        mkModel({
          id: 'subscription-model',
          authType: 'subscription',
          inputPricePerToken: 0,
          outputPricePerToken: 0,
          qualityScore: 4,
          capabilityCode: true,
        }),
        mkModel({ id: 'api-model', authType: 'api_key', qualityScore: 3 }),
      ]);
      tierRepo.find.mockResolvedValue([]);

      await svc.recalculate('agent-1');
      const inserted = tierRepo.insert.mock.calls[0][0] as Array<{
        tier: string;
        auto_assigned_route: { model: string };
      }>;
      // Every tier picks the subscription (zero-cost) model in preference.
      for (const row of inserted) {
        expect(row.auto_assigned_route.model).toBe('subscription-model');
      }
    });

    it('filters non-zero-cost subscription models when zero-cost ones exist for the same provider', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        mkModel({
          id: 'codex-free',
          authType: 'subscription',
          provider: 'openai',
          inputPricePerToken: 0,
          outputPricePerToken: 0,
          qualityScore: 3,
        }),
        mkModel({
          id: 'gpt-4o-paid-sub',
          authType: 'subscription',
          provider: 'openai',
          inputPricePerToken: 0.005,
          outputPricePerToken: 0.01,
          qualityScore: 5,
        }),
      ]);
      tierRepo.find.mockResolvedValue([]);

      await svc.recalculate('agent-1');
      const inserted = tierRepo.insert.mock.calls[0][0] as Array<{
        tier: string;
        auto_assigned_route: { model: string };
      }>;
      // The non-zero-cost subscription model is filtered out.
      for (const row of inserted) {
        expect(row.auto_assigned_route.model).not.toBe('gpt-4o-paid-sub');
      }
    });

    it('uses non-zero-cost subscription models when no zero-cost ones exist for the provider', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        mkModel({
          id: 'paid-sub',
          authType: 'subscription',
          provider: 'anthropic',
          inputPricePerToken: 0.005,
          outputPricePerToken: 0.01,
          qualityScore: 5,
        }),
      ]);
      tierRepo.find.mockResolvedValue([]);

      await svc.recalculate('agent-1');
      const inserted = tierRepo.insert.mock.calls[0][0] as Array<{
        auto_assigned_route: { model: string };
      }>;
      expect(inserted[0].auto_assigned_route.model).toBe('paid-sub');
    });

    it('sets auto_assigned_route to null when no models are discovered', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([]);
      tierRepo.find.mockResolvedValue([]);
      await svc.recalculate('agent-1');
      const inserted = tierRepo.insert.mock.calls[0][0] as Array<{
        auto_assigned_route: unknown;
      }>;
      expect(inserted.every((r) => r.auto_assigned_route === null)).toBe(true);
    });

    it('does not insert anything when every slot already exists', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([mkModel({ id: 'gpt-4o' })]);
      tierRepo.find.mockResolvedValue([
        { tier: 'simple', auto_assigned_route: null } as TierAssignment,
        { tier: 'standard', auto_assigned_route: null } as TierAssignment,
        { tier: 'complex', auto_assigned_route: null } as TierAssignment,
        { tier: 'reasoning', auto_assigned_route: null } as TierAssignment,
        { tier: 'default', auto_assigned_route: null } as TierAssignment,
      ]);
      await svc.recalculate('agent-1');
      expect(tierRepo.insert).not.toHaveBeenCalled();
      expect(tierRepo.save).toHaveBeenCalledTimes(1);
    });

    it('skips models with null authType when building routes', async () => {
      discoveryService.getModelsForAgent.mockResolvedValue([
        mkModel({ id: 'no-auth', authType: undefined }),
      ]);
      tierRepo.find.mockResolvedValue([]);
      await svc.recalculate('agent-1');
      const inserted = tierRepo.insert.mock.calls[0][0] as Array<{
        auto_assigned_route: unknown;
      }>;
      // buildRoute returns null when authType is missing.
      expect(inserted.every((r) => r.auto_assigned_route === null)).toBe(true);
    });
  });

  describe('pickBest', () => {
    it('returns null for an empty list', () => {
      expect(svc.pickBest([], 'simple')).toBeNull();
    });

    it('picks cheapest for simple tier', () => {
      const result = svc.pickBest(
        [
          mkModel({ id: 'a', inputPricePerToken: 1, outputPricePerToken: 1 }),
          mkModel({ id: 'b', inputPricePerToken: 0.1, outputPricePerToken: 0.1 }),
        ],
        'simple',
      );
      expect(result?.model_name).toBe('b');
    });

    it('treats null prices as Infinity (deferred to last)', () => {
      const result = svc.pickBest(
        [
          mkModel({ id: 'unknown', inputPricePerToken: null, outputPricePerToken: null }),
          mkModel({ id: 'known', inputPricePerToken: 0.1, outputPricePerToken: 0.1 }),
        ],
        'simple',
      );
      expect(result?.model_name).toBe('known');
    });

    it('picks cheapest tool-capable quality>=2 for standard tier', () => {
      const result = svc.pickBest(
        [
          mkModel({
            id: 'low-q',
            qualityScore: 1,
            inputPricePerToken: 0.01,
            outputPricePerToken: 0.01,
          }),
          mkModel({
            id: 'tool-2',
            qualityScore: 2,
            capabilityCode: true,
            inputPricePerToken: 0.02,
            outputPricePerToken: 0.02,
          }),
          mkModel({
            id: 'no-tool-3',
            qualityScore: 3,
            capabilityCode: false,
            inputPricePerToken: 0.05,
            outputPricePerToken: 0.05,
          }),
        ],
        'standard',
      );
      expect(result?.model_name).toBe('tool-2');
    });

    it('falls back to non-tool when no tool-capable models exist for standard', () => {
      const result = svc.pickBest(
        [
          mkModel({
            id: 'q3',
            qualityScore: 3,
            capabilityCode: false,
            inputPricePerToken: 0.01,
            outputPricePerToken: 0.01,
          }),
        ],
        'standard',
      );
      expect(result?.model_name).toBe('q3');
    });

    it('picks highest-quality tool-capable for complex tier', () => {
      const result = svc.pickBest(
        [
          mkModel({ id: 'q4', qualityScore: 4, capabilityCode: true }),
          mkModel({ id: 'q5', qualityScore: 5, capabilityCode: true }),
          mkModel({ id: 'q5-no-tool', qualityScore: 5, capabilityCode: false }),
        ],
        'complex',
      );
      expect(result?.model_name).toBe('q5');
    });

    it('picks highest-quality tool-capable reasoning model when reasoning models exist', () => {
      const result = svc.pickBest(
        [
          mkModel({
            id: 'r-tool',
            qualityScore: 4,
            capabilityReasoning: true,
            capabilityCode: true,
          }),
          mkModel({
            id: 'r-no-tool',
            qualityScore: 5,
            capabilityReasoning: true,
            capabilityCode: false,
          }),
          mkModel({ id: 'no-r', qualityScore: 6, capabilityCode: true }),
        ],
        'reasoning',
      );
      // Tool-capable wins among reasoning-capable models.
      expect(result?.model_name).toBe('r-tool');
    });

    it('falls back to highest-quality when no reasoning-capable models exist', () => {
      const result = svc.pickBest(
        [
          mkModel({ id: 'a', qualityScore: 4, capabilityReasoning: false, capabilityCode: true }),
          mkModel({ id: 'b', qualityScore: 5, capabilityReasoning: false, capabilityCode: true }),
        ],
        'reasoning',
      );
      expect(result?.model_name).toBe('b');
    });

    it('picks highest-quality reasoning model without tool capability when no tool-capable reasoning exists', () => {
      const result = svc.pickBest(
        [
          mkModel({
            id: 'r-only',
            qualityScore: 5,
            capabilityReasoning: true,
            capabilityCode: false,
          }),
        ],
        'reasoning',
      );
      expect(result?.model_name).toBe('r-only');
    });
  });
});
