import { Repository } from 'typeorm';
import { TierAutoAssignService } from './tier-auto-assign.service';
import { TierAssignment } from '../../entities/tier-assignment.entity';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import { DiscoveredModel } from '../../model-discovery/model-fetcher';

function m(partial: Partial<DiscoveredModel> & { id: string; provider: string }): DiscoveredModel {
  return {
    name: partial.id,
    authType: 'api_key',
    inputPricePerToken: null,
    outputPricePerToken: null,
    qualityScore: 3,
    capabilityCode: false,
    capabilityReasoning: false,
    ...partial,
  } as DiscoveredModel;
}

function makeService(options: {
  models?: DiscoveredModel[];
  existingTiers?: Partial<TierAssignment>[];
}) {
  const getModelsForAgent = jest.fn().mockResolvedValue(options.models ?? []);
  const find = jest.fn().mockResolvedValue(options.existingTiers ?? []);
  const save = jest.fn().mockResolvedValue(undefined);
  const insert = jest.fn().mockResolvedValue(undefined);

  const discoveryService = { getModelsForAgent } as unknown as ModelDiscoveryService;
  const tierRepo = { find, save, insert } as unknown as Repository<TierAssignment>;
  const svc = new TierAutoAssignService(discoveryService, tierRepo);
  return { svc, getModelsForAgent, find, save, insert };
}

describe('TierAutoAssignService', () => {
  describe('pickBest', () => {
    const svc = new TierAutoAssignService(
      {} as unknown as ModelDiscoveryService,
      {} as unknown as Repository<TierAssignment>,
    );

    it('returns null when no models are available', () => {
      expect(svc.pickBest([], 'simple')).toBeNull();
    });

    it('SIMPLE picks the cheapest model regardless of quality', () => {
      const models = [
        m({
          id: 'pricey',
          provider: 'x',
          inputPricePerToken: 10,
          outputPricePerToken: 10,
          qualityScore: 9,
        }),
        m({
          id: 'cheap',
          provider: 'y',
          inputPricePerToken: 1,
          outputPricePerToken: 1,
          qualityScore: 1,
        }),
      ];
      expect(svc.pickBest(models, 'simple')?.model_name).toBe('cheap');
    });

    it('STANDARD prefers tool-capable quality>=2 models over raw cheapest', () => {
      const models = [
        // cheapest but below quality threshold:
        m({
          id: 'tiny',
          provider: 'x',
          inputPricePerToken: 1,
          outputPricePerToken: 1,
          qualityScore: 1,
        }),
        // eligible:
        m({
          id: 'std',
          provider: 'y',
          inputPricePerToken: 5,
          outputPricePerToken: 5,
          qualityScore: 3,
          capabilityCode: true,
        }),
      ];
      expect(svc.pickBest(models, 'standard')?.model_name).toBe('std');
    });

    it('STANDARD falls back to the cheapest when no model meets quality>=2', () => {
      const models = [
        m({
          id: 'a',
          provider: 'x',
          inputPricePerToken: 1,
          outputPricePerToken: 1,
          qualityScore: 1,
        }),
        m({
          id: 'b',
          provider: 'x',
          inputPricePerToken: 5,
          outputPricePerToken: 5,
          qualityScore: 1,
        }),
      ];
      expect(svc.pickBest(models, 'standard')?.model_name).toBe('a');
    });

    it('COMPLEX picks highest quality, breaking ties with a tool-capable preference', () => {
      const models = [
        m({
          id: 'cheap-smart',
          provider: 'x',
          inputPricePerToken: 1,
          outputPricePerToken: 1,
          qualityScore: 9,
        }),
        m({
          id: 'tool-smart',
          provider: 'x',
          inputPricePerToken: 3,
          outputPricePerToken: 3,
          qualityScore: 9,
          capabilityCode: true,
        }),
        m({
          id: 'dumb',
          provider: 'x',
          inputPricePerToken: 1,
          outputPricePerToken: 1,
          qualityScore: 2,
        }),
      ];
      expect(svc.pickBest(models, 'complex')?.model_name).toBe('tool-smart');
    });

    it('REASONING prefers reasoning-capable models even over higher-quality non-reasoning', () => {
      const models = [
        m({
          id: 'reason',
          provider: 'x',
          inputPricePerToken: 1,
          outputPricePerToken: 1,
          qualityScore: 5,
          capabilityReasoning: true,
          capabilityCode: true,
        }),
        m({
          id: 'smart',
          provider: 'x',
          inputPricePerToken: 1,
          outputPricePerToken: 1,
          qualityScore: 9,
        }),
      ];
      expect(svc.pickBest(models, 'reasoning')?.model_name).toBe('reason');
    });

    it('REASONING falls back to the COMPLEX ordering when no reasoning models exist', () => {
      const models = [
        m({
          id: 'smart',
          provider: 'x',
          inputPricePerToken: 1,
          outputPricePerToken: 1,
          qualityScore: 9,
        }),
      ];
      expect(svc.pickBest(models, 'reasoning')?.model_name).toBe('smart');
    });

    it('treats missing prices as Infinity so fully-priced models sort first', () => {
      const models = [
        m({ id: 'unknown', provider: 'x', inputPricePerToken: null, outputPricePerToken: null }),
        m({ id: 'priced', provider: 'x', inputPricePerToken: 1, outputPricePerToken: 1 }),
      ];
      expect(svc.pickBest(models, 'simple')?.model_name).toBe('priced');
    });
  });

  describe('recalculate', () => {
    it('writes one auto-assigned model per tier, inserting missing tiers and saving the rest', async () => {
      const models: DiscoveredModel[] = [
        m({
          id: 'openai/gpt-5',
          provider: 'openai',
          inputPricePerToken: 5,
          outputPricePerToken: 5,
          qualityScore: 7,
          capabilityCode: true,
        }),
        m({
          id: 'anthropic/claude-opus-4',
          provider: 'anthropic',
          inputPricePerToken: 10,
          outputPricePerToken: 10,
          qualityScore: 9,
          capabilityCode: true,
          capabilityReasoning: true,
        }),
      ];
      // Only one existing tier row — the other three get inserted.
      const existing: Partial<TierAssignment>[] = [
        { tier: 'simple', agent_id: 'agent-1', auto_assigned_model: null },
      ];
      const { svc, save, insert } = makeService({ models, existingTiers: existing });
      await svc.recalculate('agent-1');

      expect(save).toHaveBeenCalledTimes(1);
      expect(save.mock.calls[0][0]).toHaveLength(1);
      expect(save.mock.calls[0][0][0].tier).toBe('simple');
      expect(save.mock.calls[0][0][0].auto_assigned_model).toBe('openai/gpt-5');

      expect(insert).toHaveBeenCalledTimes(1);
      const inserted = insert.mock.calls[0][0] as Record<string, unknown>[];
      expect(inserted.map((r) => r.tier).sort()).toEqual([
        'complex',
        'default',
        'reasoning',
        'standard',
      ]);
      for (const row of inserted) {
        expect(row.agent_id).toBe('agent-1');
        // Every tier should have picked something (non-null).
        expect(row.auto_assigned_model).not.toBeNull();
      }
    });

    it('prefers subscription models over API-key models for every tier', async () => {
      const models: DiscoveredModel[] = [
        m({
          id: 'openai/gpt-5',
          provider: 'openai',
          authType: 'api_key',
          inputPricePerToken: 1,
          outputPricePerToken: 1,
          qualityScore: 7,
        }),
        m({
          id: 'openai/codex-mini',
          provider: 'openai',
          authType: 'subscription',
          // Zero-cost — filterSubModels will keep only zero-cost models.
          inputPricePerToken: 0,
          outputPricePerToken: 0,
          qualityScore: 5,
        }),
      ];
      const { svc, insert } = makeService({ models });
      await svc.recalculate('agent-1');
      const inserted = insert.mock.calls[0][0] as Record<string, unknown>[];
      for (const row of inserted) {
        expect(row.auto_assigned_model).toBe('openai/codex-mini');
      }
    });

    it('keeps all subscription models for a provider that has no zero-cost options', async () => {
      // Anthropic subscription models are priced (not zero-cost). filterSubModels should keep them.
      const models: DiscoveredModel[] = [
        m({
          id: 'anthropic/claude-opus-4',
          provider: 'anthropic',
          authType: 'subscription',
          inputPricePerToken: 10,
          outputPricePerToken: 10,
          qualityScore: 9,
        }),
      ];
      const { svc, insert } = makeService({ models });
      await svc.recalculate('agent-1');
      const inserted = insert.mock.calls[0][0] as Record<string, unknown>[];
      for (const row of inserted) {
        expect(row.auto_assigned_model).toBe('anthropic/claude-opus-4');
      }
    });

    it('writes nulls when no models are connected', async () => {
      const { svc, insert } = makeService({ models: [] });
      await svc.recalculate('agent-1');
      const inserted = insert.mock.calls[0][0] as Record<string, unknown>[];
      for (const row of inserted) {
        expect(row.auto_assigned_model).toBeNull();
      }
    });
  });
});
